/*jslint nomen:true*/
/*global define*/
define(function (require) {
    'use strict';

    var ActivityListView,
        $ = require('jquery'),
        _ = require('underscore'),
        __ = require('orotranslation/js/translator'),
        routing = require('routing'),
        mediator = require('oroui/js/mediator'),
        LoadingMask = require('oroui/js/loading-mask'),
        DialogWidget = require('oro/dialog-widget'),
        DeleteConfirmation = require('oroui/js/delete-confirmation'),
        BaseCollectionView = require('oroui/js/app/views/base/collection-view');

    ActivityListView = BaseCollectionView.extend({
        options: {
            configuration: {},
            template: null,
            itemTemplate: null,
            itemViewIdPrefix: 'activity-',
            listSelector: '.items.list-box',
            fallbackSelector: '.no-data',
            loadingSelector: '.loading-mask',
            collection: null,
            urls: {
                viewItem: null,
                updateItem: null,
                deleteItem: null
            },
            messages: {}
        },
        listen: {
            'toView collection': '_viewItem',
            'toEdit collection': '_editItem',
            'toDelete collection': '_deleteItem'
        },

        initialize: function (options) {
            this.options = _.defaults(options || {}, this.options);

            _.defaults(this.options.messages, {
                editDialogTitle: __('oro.activitylist.edit_title'),
                itemSaved: __('oro.activitylist.item_saved'),
                itemRemoved: __('oro.activitylist.item_removed'),

                deleteConfirmation: __('oro.activitylist.delete_confirmation'),
                deleteItemError: __('oro.activitylist.delete_error'),

                loadItemsError: __('oro.activitylist.load_error'),
                forbiddenError: __('oro.activitylist.forbidden_error')
            });

            this.template = _.template($(this.options.template).html());

            /**
             * on editing activity item listen to "widget_success:activity_list:item:update"
             */
            mediator.on('widget_success:activity_list:item:update', _.bind(function () {
                this.refresh();
            }, this));

            ActivityListView.__super__.initialize.call(this, options);
        },

        /**
         * @inheritDoc
         */
        dispose: function () {
            if (this.disposed) {
                return;
            }
            delete this.itemEditDialog;
            delete this.$loadingMaskContainer;
            ActivityListView.__super__.dispose.call(this);
        },

        render: function () {
            ActivityListView.__super__.render.apply(this, arguments);
            this.$loadingMaskContainer = this.$('.loading-mask');
            return this;
        },

        expandAll: function () {
            _.each(this.subviews, function (itemView) {
                itemView.toggle(false);
            });
        },

        collapseAll: function () {
            _.each(this.subviews, function (itemView) {
                itemView.toggle(true);
            });
        },

        refresh: function () {
            this.collection.setPage(1);
            this._reload();
        },

        filter: function () {
            this._filter();
        },

        more: function () {
            this._more();
        },

        goto_first: function () {
            alert('first');
        },
        goto_next: function () {
            alert('next');
        },
        goto_previous: function () {
            alert('previous');
        },
        goto_last: function () {
            alert('last');
        },

        _reload: function () {
            this._showLoading();
            try {
                this.collection.fetch({
                    reset: true,
                    success: _.bind(function () {
                        this._hideLoading();
                    }, this),
                    error: _.bind(function (collection, response) {
                        this._showLoadItemsError(response.responseJSON || {});
                    }, this)
                });
            } catch (err) {
                this._showLoadItemsError(err);
            }
        },

        _filter: function () {
            alert('filter');
        },

        _more: function (page) {
            if (_.isUndefined(page)) {
                this.collection.setPage(this.collection.getPage() + 1);
            }
            this._showLoading();
            try {
                this.collection.fetch({
                    reset: false,
                    success: _.bind(function () {
                        this._hideLoading();
                    }, this),
                    error: _.bind(function (collection, response) {
                        this._showLoadItemsError(response.responseJSON || {});
                    }, this)
                });
            } catch (err) {
                this._showLoadItemsError(err);
            }
        },

        _viewItem: function (model, modelView) {
            var that = this,
                currentModel = model,
                currentModelView = modelView,
                options = {
                    url: this._getUrl('itemView', model),
                    type: 'get',
                    dataType: 'html',
                    data: {
                        _widgetContainer: 'dialog'
                    }
                };

            if (currentModel.get('is_loaded') !== true) {
                this._showLoading();
                Backbone.$.ajax(options)
                    .done(function (data) {
                        var response = jQuery('<html />').html(data);
                        currentModel.set('is_loaded', true);
                        currentModel.set('contentHTML', jQuery(response).find('.widget-content').html());

                        that._hideLoading();

                        currentModelView.toggle();
                    })
                    .fail(_.bind(this._showLoadItemsError, this));
            } else {
                currentModelView.toggle();
            }
        },

        _editItem: function (model) {
            if (!this.itemEditDialog) {
                this.itemEditDialog = new DialogWidget({
                    'url': this._getUrl('itemEdit', model),
                    'title': model.get('subject'),
                    'regionEnabled': false,
                    'incrementalPosition': false,
                    'alias': 'activity_list:item:update',
                    'dialogOptions': {
                        'modal': true,
                        'resizable': false,
                        'width': 675,
                        'autoResize': true,
                        'close': _.bind(function () {
                            delete this.itemEditDialog;
                        }, this)
                    }
                });

                this.itemEditDialog.render();
            }
        },

        _deleteItem: function (model) {
            var confirm = new DeleteConfirmation({
                content: this._getMessage('deleteConfirmation')
            });
            confirm.on('ok', _.bind(function () {
                this._onItemDelete(model);
            }, this));
            confirm.open();
        },

        _onItemDelete: function (model) {
            this._showLoading();
            try {
                model.destroy({
                    wait: true,
                    url: this._getUrl('itemDelete', model),
                    success: _.bind(function () {
                        this._hideLoading();
                        mediator.execute('showFlashMessage', 'success', this._getMessage('itemRemoved'));
                    }, this),
                    error: _.bind(function (model, response) {
                        if (!_.isUndefined(response.status) && response.status === 403) {
                            this._showForbiddenError(response.responseJSON || {});
                        } else {
                            this._showDeleteItemError(response.responseJSON || {});
                        }
                    }, this)
                });

                this.refresh();

            } catch (err) {
                this._showDeleteItemError(err);
            }
        },

        /**
         * Fetches url for certain action
         *
         * @param {string} actionKey
         * @param {Backbone.Model=}model
         * @returns {string}
         * @protected
         */
        _getUrl: function (actionKey, model) {
            var route = this.options.configuration[model.get('relatedActivityClass')].routes[actionKey];
            return routing.generate(route, {'id': model.get('relatedActivityId')});
        },

        _getMessage: function (labelKey) {
            return this.options.messages[labelKey];
        },

        _showLoading: function () {
            if (!this.$loadingMaskContainer.data('loading-mask-visible')) {
                this.loadingMask = new LoadingMask();
                this.$loadingMaskContainer.data('loading-mask-visible', true);
                this.$loadingMaskContainer.append(this.loadingMask.render().$el);
                this.loadingMask.show();
            }
        },

        _hideLoading: function () {
            if (this.loadingMask) {
                this.$loadingMaskContainer.data('loading-mask-visible', false);
                this.loadingMask.remove();
                this.loadingMask = null;
            }
        },

        _showLoadItemsError: function (err) {
            this._showError(this.options.messages.loadItemsError, err);
        },

        _showDeleteItemError: function (err) {
            this._showError(this.options.messages.deleteItemError, err);
        },

        _showForbiddenError: function (err) {
            this._showError(this.options.messages.forbiddenError, err);
        },

        _showError: function (message, err) {
            this._hideLoading();
            mediator.execute('showErrorMessage', message, err);
        }
    });

    return ActivityListView;
});
