const { db } = require('../handlers/db.js');
const CatLoggr = require('cat-loggr');
const log = new CatLoggr();

/**
 * Checks if the user is authorized to access the specified container ID.
 * @param {string} userId - The unique identifier of the user.
 * @param {string} containerId - The container ID to check authorization for.
 * @returns {Promise<boolean>} True if the user is authorized, otherwise false.
 */
async function isUserAuthorizedForContainer(userId, containerId) {
    try {
        const userInstances = await db.get(userId + '_instances') || [];
        const users = await db.get('users') || [];

        const user = users.find(user => user.userId === userId);
        if (!user) {
            log.error(`User not found: ${userId}`);
            return false;
        }

        if (user.admin) return true;

        const subUserInstances = user.accessTo || [];
        const isInSubUserInstances = subUserInstances.includes(containerId);
        const isInUserInstances = userInstances.some(instance => instance.Id === containerId);

        return isInSubUserInstances || isInUserInstances;
    } catch (error) {
        log.error('Error checking user authorization:', error);
        return false;
    }
}

/**
 * Checks if an instance is suspended.
 * @param {string} instanceId - The ID of the instance.
 * @returns {Promise<boolean>} True if suspended, otherwise false.
 */
async function isInstanceSuspended(instanceId) {
    try {
        let instance = await db.get(`${instanceId}_instance`);

        if (!instance) {
            instance = { suspended: false };
            await db.set(`${instanceId}_instance`, instance);
        }

        if (typeof instance.suspended === 'undefined') {
            instance.suspended = false;
            await db.set(`${instanceId}_instance`, instance);
        }

        return instance.suspended === true;
    } catch (error) {
        log.error(`Error checking suspension status for instance ${instanceId}:`, error);
        return false;
    }
}

module.exports = {
    isUserAuthorizedForContainer,
    isInstanceSuspended
};
