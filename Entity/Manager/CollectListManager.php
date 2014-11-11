<?php

namespace Oro\Bundle\ActivityListBundle\Entity\Manager;

use Doctrine\ORM\EntityManager;

use Oro\Bundle\ActivityListBundle\Entity\ActivityList;
use Oro\Bundle\ActivityListBundle\Provider\ActivityListChainProvider;

class CollectListManager
{
    const STATE_CREATE = 'create';
    const STATE_UPDATE = 'update';

    /** @var ActivityListChainProvider */
    protected $chainProvider;

    /**
     * @param ActivityListChainProvider $chainProvider
     */
    public function __construct(
        ActivityListChainProvider $chainProvider
    ) {
        $this->chainProvider = $chainProvider;
    }

    /**
     * Check if given entity supports by activity list providers
     *
     * @param $entity
     * @return bool
     */
    public function isSupportedEntity($entity)
    {
        return $this->chainProvider->isSupportedEntity($entity);
    }

    /**
     * @param array         $deletedEntities
     * @param EntityManager $entityManager
     */
    public function processDeletedEntities($deletedEntities, EntityManager $entityManager)
    {
        if (!empty($deletedEntities)) {
            foreach ($deletedEntities as $entity) {
                $entityManager->getRepository('OroActivityListBundle:ActivityList')->createQueryBuilder('list')
                    ->delete()
                    ->where('list.relatedActivityClass = :relatedActivityClass')
                    ->andWhere('list.relatedActivityId = :relatedActivityId')
                    ->setParameter('relatedActivityClass', $entity['class'])
                    ->setParameter('relatedActivityId', $entity['id'])
                    ->getQuery()
                    ->execute();
            }
        }
    }

    /**
     * @param array         $updatedEntities
     * @param EntityManager $entityManager
     * @return bool
     */
    public function processUpdatedEntities($updatedEntities, EntityManager $entityManager)
    {
        if (!empty($updatedEntities)) {
            $metaData = $entityManager->getClassMetadata(ActivityList::ENTITY_CLASS);
            foreach ($updatedEntities as $entity) {
                $activityList = $this->chainProvider->getUpdatedActivityList($entity, $entityManager);
                if ($activityList) {
                    $entityManager->persist($activityList);
                    $entityManager->getUnitOfWork()->computeChangeSet(
                        $metaData,
                        $activityList
                    );
                }
            }

            return true;
        }

        return false;
    }

    /**
     * @param array         $insertedEntities
     * @param EntityManager $entityManager
     * @return bool
     */
    public function processInsertEntities($insertedEntities, EntityManager $entityManager)
    {
        if (!empty($insertedEntities)) {
            foreach ($insertedEntities as $entity) {
                $entityManager->persist($this->chainProvider->getActivityListEntitiesByActivityEntity($entity));
            }

            return true;
        }

        return false;
    }
}
