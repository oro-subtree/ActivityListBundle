/*global define, require*/
/*jslint nomen: true*/
define([
    'jquery',
    'underscore',
    'orotranslation/js/translator',
    'oro/filter/choice-filter',
    'oro/filter/multiselect-filter',
    'oroquerydesigner/js/field-condition'
], function($, _, __, ChoiceFilter, MultiSelectFilter) {
    'use strict';

    $.widget('oroactivity.activityCondition', $.oroquerydesigner.fieldCondition, {
        options: {
            listOption: {},
            filters: {},
            entitySelector: null,
            filterContainer: '<span class="active-filter">'
        },

        _create: function () {
            this.options.fieldChoice.dataFilter = function (entityName, entityFields) {
                var excludedFields = {
                    'Oro\\Bundle\\EmailBundle\\Entity\\Email': [
                        'importance',
                        'internalDate',
                        'head',
                        'seen',
                        'refs',
                        'xMessageId',
                        'xThreadId',
                    ],
                };

                if (!_.has(excludedFields, entityName)) {
                    return entityFields;
                }

                return _.reject(entityFields, function (field) {
                    return _.contains(excludedFields[entityName], field.name);
                });
            };

            var data = this.element.data('value');
            this.$fieldsLoader = $(this.options.fieldsLoaderSelector);

            this.element.data('value', {});
            this._superApply(arguments);
            this.element.data('value', data);

            var data = $.extend(true, {
                criterion: {
                    data: {
                        filterType: 'hasActivity',
                        activityType: {}
                    }
                }
            }, this.element.data('value'));

            this.activityFilter = new ChoiceFilter({
                caret: '',
                templateSelector: '#simple-choice-filter-template-embedded',
                choices: {
                    hasActivity: __('oro.activityCondition.hasActivity'),
                    hasNotActivity: __('oro.activityCondition.hasNotActivity')
                }
            });
            this.activityFilter.setValue({
                type: data.criterion.data.filterType
            });
            this.$activityChoice = $(this.options.filterContainer).html(this.activityFilter.render().$el);

            var listOption = JSON.parse(this.options.listOption);
            var typeChoices = {};
            _.each(listOption, function (options, id) {
                typeChoices[id] = options.label;
            });
            this.typeFilter = new MultiSelectFilter({
                label: __('oro.activityCondition.listOfActivityTypes'),
                choices: typeChoices
            });
            this.$typeChoice = $(this.options.filterContainer).html(this.typeFilter.render().$el);
            this.typeFilter.setValue(data.criterion.data.activityType);
            var filterOptions = _.findWhere(this.options.filters, {
                type: 'datetime'
            });
            if (!filterOptions) {
                throw new Error('Cannot find filter "datetime"');
            }

            this.element.prepend(this.$activityChoice, '-', this.$typeChoice, '-');

            this._updateFieldChoice();
            if (data && data.columnName) {
                this.element.one('changed', _.bind(function () {
                    this.filter.setValue(data.criterion.data.filter.data);
                }, this));
                this.selectField(base64_decode(data.columnName));
            }

            this.activityFilter.on('update', _.bind(this._onUpdate, this));
            this.typeFilter.on('update', _.bind(this._onUpdate, this));

            this._on(this.$activityChoice, {
                change: function () {
                    this.activityFilter.applyValue();
                }
            });

            this.typeFilter.on('update', _.bind(function () {
                var oldEntity = this.$fieldChoice.data('entity');
                var newEntity = this._getTypeChoiceEntity();

                if (oldEntity !== newEntity) {
                    this.$fieldChoice.fieldChoice('setValue', '');
                    this.$filterContainer.empty();
                    if (this.filter) {
                        this.filter.reset();
                    }
                }

                this.$fieldChoice.fieldChoice('updateData', newEntity, this.$fieldsLoader.data('fields'));
            }, this));

            this._on(this.$typeChoice, {
                change: function (e) {
                    this.typeFilter.applyValue();
                }
            });
        },

        _getTypeChoiceEntity: function () {
            var entity = '$activity';

            var first = _.first(this.typeFilter.value.value);
            if (this.typeFilter.value.value.length === 1 && !_.isEmpty(first)) {
                entity = first.replace(/_/g, '\\');
            }

            return entity;
        },

        _updateFieldChoice: function () {
            this._on(this.$fieldsLoader, {
                fieldsloaderupdate: function (e, data) {
                    this.$fieldChoice.fieldChoice('setValue', '');
                    this.$fieldChoice.fieldChoice('updateData', this._getTypeChoiceEntity(), data);
                }
            });
            this._updateFieldsLoader();
            this.$fieldChoice.fieldChoice('updateData', this._getTypeChoiceEntity(), this.$fieldsLoader.data('fields'));

            var fieldChoice = this.$fieldChoice.fieldChoice().data('oroentity-fieldChoice');
            var originalSelect2Data = fieldChoice._select2Data;
            fieldChoice._select2Data = function (path) {
                var results = originalSelect2Data.apply(this, arguments);
                if (_.isEmpty(results)) {
                    return results;
                }

                var fields = _.first(results).children;
                var activities = _.filter(fields, function (item) {
                    return item.id[0] === '$';
                });
                fields = _.reject(fields, function (item) {
                    return item.id[0] === '$';
                });

                _.first(results).children = fields;
                if (_.isEmpty(fields)) {
                    results.shift();
                }
                results.unshift({
                    text: 'Activity',
                    children: activities
                });

                return results;
            };

            var originalGetApplicableConditions = fieldChoice.getApplicableConditions;
            fieldChoice.getApplicableConditions = function (fieldId) {
                var result = originalGetApplicableConditions.apply(this, arguments);
                if (_.isEmpty(result) && _.contains(['createdAt', 'updatedAt'], fieldId)) {
                    result = {
                        parent_entity: null,
                        entity: null,
                        field: fieldId,
                        type: 'datetime'
                    };
                }

                return result;
            };
        },

        _updateFieldsLoader: function () {
            if (this.$fieldsLoader.data('activityFieldsUpdated')) {
                return;
            }

            var classNames = _.map(this.typeFilter.choices, function (item) {
                return item.value.replace(/_/g, '\\');
            });
            var data = this.$fieldsLoader.data('fields');
            _.each(classNames, function (className) {
                this._updateEntityWithActivityFields(data[className]);
            }, this);
            data['$activity'] = {
                fields: [],
                fieldsIndex: {},
                label: '',
                name: '$activity',
                plural_label: ''
            };
            this._updateEntityWithActivityFields(data['$activity']);

            this.$fieldsLoader.data('fields', data);
            this.$fieldsLoader.data('activityFieldsUpdated', true);
        },

        _updateEntityWithActivityFields: function (entity) {
            var fields = [
                {
                    label: __('oro.activitylist.created_at.label'),
                    name: '$createdAt',
                    type: 'datetime',
                    entity: entity
                },
                {
                    label: __('oro.activitylist.updated_at.label'),
                    name: '$updatedAt',
                    type: 'datetime',
                    entity: entity
                }
            ];
            entity.fieldsIndex['$createdAt'] = fields[0];
            entity.fieldsIndex['$updatedAt'] = fields[1];

            entity.fields.push(fields[0], fields[1]);
        },

        _getFilterCriterion: function () {
            var filter = {
                filter: this.filter.name,
                data: this.filter.getValue()
            };

            if (this.filter.filterParams) {
                filter.params = this.filter.filterParams;
            }

            return {
                filter: 'activityList',
                data: {
                    filterType: this.$activityChoice.find(':input').val(),
                    activityType: this.typeFilter.getValue(),
                    filter: filter,
                    entityClassName: $(this.options.entitySelector).val()
                }
            };
        },

        _onUpdate: function () {
            var value;

            if (this.filter && !this.filter.isEmptyValue()) {
                value = {
                    columnName: base64_encode(this.element.find('input.select').select2('val')),
                    criterion: this._getFilterCriterion()
                };
            } else {
                value = {};
            }

            this.element.data('value', value);
            this.element.trigger('changed');
        },

        _destroy: function () {
            this._superApply(arguments);

            this.activityFilter.dispose();
            delete this.activityFilter;

            this.typeFilter.dispose();
            delete this.typeFilter;
        }
    });
});
