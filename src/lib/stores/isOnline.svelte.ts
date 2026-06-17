/**
 * Reactive connectivity store using Svelte 5 runes.
 * Tracks navigator.onLine and provides a derived $state for components.
 */
import { browser } from "$app/environment";

class IsOnlineStore {
	#online = $state<boolean>(browser ? navigator.onLine : true);

	constructor() {
		if (!browser) return;

		const handleOnline = () => {
			this.#online = true;
		};

		const handleOffline = () => {
			this.#online = false;
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
	}

	get value(): boolean {
		return this.#online;
	}
}

let store: IsOnlineStore | undefined;

export function createIsOnlineStore(): IsOnlineStore {
	if (!store) {
		store = new IsOnlineStore();
	}
	return store;
}

export function useIsOnline(): IsOnlineStore {
	if (!store) {
		store = new IsOnlineStore();
	}
	return store;
}
