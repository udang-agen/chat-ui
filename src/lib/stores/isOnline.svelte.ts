import { browser } from "$app/environment";

let _isOnline = $state(true);

// Store subscribers for $isOnline syntax in .svelte files
const subscribers = new Set<(value: boolean) => void>();

function notifySubscribers(): void {
	for (const fn of subscribers) {
		fn(_isOnline);
	}
}

if (browser) {
	window.addEventListener("online", () => {
		_isOnline = true;
		notifySubscribers();
	});
	window.addEventListener("offline", () => {
		_isOnline = false;
		notifySubscribers();
	});
}

export const isOnline = {
	get value() {
		return _isOnline;
	},
	subscribe(run: (value: boolean) => void): () => void {
		run(_isOnline);
		subscribers.add(run);
		return () => {
			subscribers.delete(run);
		};
	},
};
