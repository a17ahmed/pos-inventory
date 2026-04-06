/**
 * Simple event emitter for auth-related events (token expiry, forced logout).
 *
 * The Axios interceptor can't access React Navigation directly,
 * so it emits an event that the App component listens to and
 * triggers a navigation reset to the login screen.
 */

const listeners = new Set();

export const authEvents = {
    /**
     * Subscribe to auth events (called from App.js or a top-level component)
     * @param {function} callback - called with { type: 'SESSION_EXPIRED' | 'UNAUTHORIZED' }
     * @returns {function} unsubscribe function
     */
    subscribe(callback) {
        listeners.add(callback);
        return () => listeners.delete(callback);
    },

    /**
     * Emit an auth event (called from api.js interceptor or socket service)
     * @param {{ type: string }} event
     */
    emit(event) {
        listeners.forEach(cb => {
            try {
                cb(event);
            } catch (e) {
                console.error('Auth event listener error:', e);
            }
        });
    },
};
