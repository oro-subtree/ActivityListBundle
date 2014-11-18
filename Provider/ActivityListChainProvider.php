<?php

namespace Oro\Bundle\ActivityListBundle\Provider;

use Doctrine\ORM\EntityManager;

use Symfony\Component\Translation\TranslatorInterface;

use Oro\Bundle\EntityBundle\ORM\DoctrineHelper;
use Oro\Bundle\EntityBundle\Tools\EntityRoutingHelper;
use Oro\Bundle\EntityConfigBundle\Config\ConfigManager;
use Oro\Bundle\EntityConfigBundle\Config\Id\ConfigIdInterface;
use Oro\Bundle\ActivityListBundle\Entity\ActivityList;
use Oro\Bundle\ActivityListBundle\Model\ActivityListProviderInterface;

class ActivityListChainProvider
{
    /** @var DoctrineHelper */
    protected $doctrineHelper;

    /** @var ActivityListProviderInterface[] */
    protected $providers;

    /** @var ConfigManager */
    protected $configManager;

    /** @var TranslatorInterface */
    protected $translator;

    /** @var EntityRoutingHelper */
    protected $routingHelper;

    /** @var array */
    protected $targetClasses = [];

    /**
     * @param DoctrineHelper      $doctrineHelper
     * @param ConfigManager       $configManager
     * @param TranslatorInterface $translator
     * @param EntityRoutingHelper $routingHelper
     */
    public function __construct(
        DoctrineHelper $doctrineHelper,
        ConfigManager $configManager,
        TranslatorInterface $translator,
        EntityRoutingHelper $routingHelper
    ) {
        $this->doctrineHelper = $doctrineHelper;
        $this->configManager  = $configManager;
        $this->translator     = $translator;
        $this->routingHelper  = $routingHelper;
    }

    /**
     * Add activity list provider
     *
     * @param ActivityListProviderInterface $provider
     */
    public function addProvider(ActivityListProviderInterface $provider)
    {
        $this->providers[$provider->getActivityClass()] = $provider;
    }

    /**
     * Get array with all target classes (entities where activity can be assigned to)
     *
     * @return array
     */
    public function getTargetEntityClasses()
    {
        if (empty($this->targetClasses)) {
            /** @var ConfigIdInterface[] $configIds */
            $configIds = $this->configManager->getIds('entity');
            foreach ($configIds as $configId) {
                foreach ($this->providers as $provider) {
                    if ($provider->isApplicableTarget($configId, $this->configManager)
                        && !in_array($configId->getClassName(), $this->targetClasses)
                    ) {
                        $this->targetClasses[] = $configId->getClassName();
                    }
                }
            }
        }

        return $this->targetClasses;
    }

    /**
     * Get array with supported activity classes
     *
     * @return array
     */
    public function getSupportedActivities()
    {
        return array_keys($this->providers);
    }

    /**
     * Check if given activity entity supports by activity list providers
     *
     * @param $entity
     *
     * @return bool
     */
    public function isSupportedEntity($entity)
    {
        return in_array($this->doctrineHelper->getEntityClass($entity), array_keys($this->providers));
    }

    /**
     * Returns new activity list entity for given activity
     *
     * @param object $activityEntity
     *
     * @return ActivityList
     */
    public function getActivityListEntitiesByActivityEntity($activityEntity)
    {
        $provider = $this->getProviderForEntity($activityEntity);

        return $this->getActivityListEntityForEntity($activityEntity, $provider);
    }

    /**
     * Returns updated activity list entity for given activity
     *
     * @param object        $entity
     * @param EntityManager $entityManager
     *
     * @return ActivityList
     */
    public function getUpdatedActivityList($entity, EntityManager $entityManager)
    {
        $provider        = $this->getProviderForEntity($entity);
        $existListEntity = $entityManager->getRepository('OroActivityListBundle:ActivityList')->findOneBy(
            [
                'relatedActivityClass' => $this->doctrineHelper->getEntityClass($entity),
                'relatedActivityId'    => $this->doctrineHelper->getSingleEntityIdentifier($entity)
            ]
        );

        if ($existListEntity) {
            return $this->getActivityListEntityForEntity(
                $entity,
                $provider,
                ActivityList::VERB_UPDATE,
                $existListEntity
            );
        }

        return null;
    }

    /**
     * @return array
     */
    public function getActivityListOption()
    {
        $entityConfigProvider = $this->configManager->getProvider('entity');

        $templates = [];
        foreach ($this->providers as $provider) {
            $entityConfig = $entityConfigProvider->getConfig($provider->getActivityClass());
            $templates[$this->routingHelper->encodeClassName($provider->getActivityClass())] = [
                'icon'     => $entityConfig->get('icon'),
                'label'    => $this->translator->trans($entityConfig->get('label')),
                'template' => $provider->getTemplate(),
                'routes'   => $provider->getRoutes(),
            ];
        }

        return $templates;
    }

    /**
     * @param object $entity
     *
     * @return string|null
     */
    public function getSubject($entity)
    {
        foreach ($this->providers as $provider) {
            if ($provider->isApplicable($entity)) {
                return $provider->getSubject($entity);
            }
        }

        return null;
    }

    /**
     * Get activity list provider for given activity entity
     *
     * @param $activityEntity
     *
     * @return ActivityListProviderInterface
     */
    public function getProviderForEntity($activityEntity)
    {
        return $this->providers[$this->doctrineHelper->getEntityClass($activityEntity)];
    }

    /**
     * @param object                        $entity
     * @param ActivityListProviderInterface $provider
     * @param string                        $verb
     * @param ActivityList|null             $list
     *
     * @return ActivityList
     */
    protected function getActivityListEntityForEntity(
        $entity,
        ActivityListProviderInterface $provider,
        $verb = ActivityList::VERB_CREATE,
        $list = null
    ) {
        if (!$list) {
            $list = new ActivityList();
        }

        $list->setSubject($provider->getSubject($entity));
        $list->setVerb($verb);

        if ($verb === ActivityList::VERB_UPDATE) {
            $activityListTargets = $list->getActivityListTargetEntities();
            foreach ($activityListTargets as $target) {
                $list->removeActivityListTarget($target);
            }
        } else {
            $className = $this->doctrineHelper->getEntityClass($entity);
            $list->setRelatedActivityClass($className);
            $list->setRelatedActivityId($this->doctrineHelper->getSingleEntityIdentifier($entity));
            $list->setOrganization($provider->getOrganization($entity));
        }

        $targets = $provider->getTargetEntities($entity);
        foreach ($targets as $target) {
            if ($list->supportActivityListTarget($this->doctrineHelper->getEntityClass($target))) {
                $list->addActivityListTarget($target);
            }
        }

        return $list;
    }
}
