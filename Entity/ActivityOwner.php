<?php

namespace Oro\Bundle\ActivityListBundle\Entity;

use BeSimple\SoapBundle\ServiceDefinition\Annotation as Soap;

use Doctrine\ORM\Mapping as ORM;
use Doctrine\Common\Collections\Criteria;

use Oro\Bundle\DataAuditBundle\Metadata\Annotation as Oro;
use Oro\Bundle\OrganizationBundle\Entity\Organization;
use Oro\Bundle\UserBundle\Entity\User;

/**
 * @ORM\Table(name="oro_activity_owner")
 * @ORM\Entity()
 */
class ActivityOwner
{
    /**
     * @var integer
     *
     * @ORM\Column(name="id", type="integer")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="AUTO")
     * @Soap\ComplexType("int", nillable=true)
     */
    protected $id;

    /**
     * @var ActivityList
     *
     * @ORM\ManyToOne(targetEntity="Oro\Bundle\ActivityListBundle\Entity\ActivityList", inversedBy="activityOwners")
     * @ORM\JoinColumn(name="activity_id", referencedColumnName="id")
     */
    protected $activity;

    /**
     * @var Organization
     *
     * @ORM\ManyToOne(targetEntity="Oro\Bundle\OrganizationBundle\Entity\Organization")
     * @ORM\JoinColumn(name="organization_id", referencedColumnName="id")
     */
    protected $organization;

    /**
     * @var User
     *
     * @ORM\ManyToOne(targetEntity="Oro\Bundle\UserBundle\Entity\User")
     * @ORM\JoinColumn(name="user_id", referencedColumnName="id")
     * @Soap\ComplexType("Oro\Bundle\UserBundle\Entity\User")
     */
    protected $user;

    /**
     * Get organization
     *
     * @return Organization
     */
    public function getOrganization()
    {
        return $this->organization;
    }

    /**
     * Set organization
     *
     * @param Organization $organization
     *
     * @return self
     */
    public function setOrganization(Organization $organization = null)
    {
        $this->organization = $organization;

        return $this;
    }

    /**
     * Get activity
     *
     * @return ActivityList
     */
    public function getActivity()
    {
        return $this->activity;
    }

    /**
     * Set activity
     *
     * @param ActivityList $activity
     *
     * @return self
     */
    public function setActivity(ActivityList $activity = null)
    {
        $this->activity = $activity;

        return $this;
    }

    /**
     * @param User $user
     *
     * @return self
     */
    public function setUser(User $user = null)
    {
        $this->user = $user;

        return $this;
    }

    /**
     * @return User
     */
    public function getUser()
    {
        return $this->user;
    }

    /**
     * @param array $stack
     * @return bool
     */
    public function isMatchInCollection($stack)
    {
        $criteria = new Criteria();
        $criteria
            ->andWhere($criteria->expr()->eq('organization', $this->getOrganization()))
            ->andWhere($criteria->expr()->eq('user', $this->getUser()));

        return (bool) count($stack->matching($criteria));
    }
}
