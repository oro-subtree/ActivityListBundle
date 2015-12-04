<?php

namespace Oro\Bundle\ActivityListBundle\EventListener;

use Symfony\Component\Translation\TranslatorInterface;

use Oro\Bundle\ActivityBundle\Manager\ActivityManager;
use Oro\Bundle\EntityMergeBundle\Event\EntityMetadataEvent;
use Oro\Bundle\EntityMergeBundle\Event\EntityDataEvent;
use Oro\Bundle\EntityMergeBundle\Metadata\EntityMetadata;
use Oro\Bundle\EntityMergeBundle\Metadata\FieldMetadata;
use Oro\Bundle\EntityMergeBundle\Model\MergeModes;

class MergeListener
{
    /** @var ActivityManager */
    protected $activityManager;

    /** @var TranslatorInterface */
    protected $translator;

    /**
     * @param ActivityManager $activityManager
     * @param TranslatorInterface $translator
     */
    public function __construct(
        ActivityManager $activityManager,
        TranslatorInterface $translator
    ) {
        $this->activityManager = $activityManager;
        $this->translator = $translator;
    }

    /**
     * @param EntityMetadataEvent $event
     */
    public function onBuildMetadata(EntityMetadataEvent $event)
    {
        $entityMetadata = $event->getEntityMetadata();
        $types = $this->getAvailableActivityTypes($entityMetadata);

        foreach ($types as $type) {
            $fieldMetadataOptions = [
                'display'       => true,
                'activity'      => true,
                'type'          => $type,
                'field_name'    => $this->getFieldNameByActivityClassName($type),
                'is_collection' => true,
                'label'         =>
                    $this->translator->trans('oro.activitylist.entity_plural_label') . ' ('
                    . $this->getAliasByActivityClass($type)
                    . ')',
                'merge_modes'   => [MergeModes::REPLACE, MergeModes::UNITE]
            ];

            $fieldMetadata = new FieldMetadata($fieldMetadataOptions);
            $entityMetadata->addFieldMetadata($fieldMetadata);
        }
    }

    /**
     * Load activities
     *
     * @param EntityDataEvent $event
     */
    public function onCreateEntityData(EntityDataEvent $event)
    {
        $entityData     = $event->getEntityData();
        $entityMetadata = $entityData->getMetadata();
        $types = $this->getAvailableActivityTypes($entityMetadata);
        $entities = $entityData->getEntities();
    }

    /**
     * Save activities
     *
     * @param EntityDataEvent $event
     */
    public function afterMergeEntity(EntityDataEvent $event)
    {
        $entityData     = $event->getEntityData();
        $entityMetadata = $entityData->getMetadata();
        $types = $this->getAvailableActivityTypes($entityMetadata);
    }

    /**
     * @param EntityMetadata $entityMetadata
     *
     * @return array
     */
    protected function getAvailableActivityTypes(EntityMetadata $entityMetadata)
    {
        $className = $entityMetadata->getClassName();
        $types = $this->activityManager->getActivities($className);

        return array_keys($types);
    }

    /**
     * @param string $className
     *
     * @return string
     */
    protected function getFieldNameByActivityClassName($className)
    {
        return strtolower(str_replace('\\', '_', $className));
    }

    /**
     * @param string $className
     *
     * @return string
     */
    protected function getAliasByActivityClass($className)
    {
        return strtolower(str_replace('\\', '_', $className));
    }
}
