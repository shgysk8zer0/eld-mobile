import './std-js/deprefixer.js';
import './std-js/shims.js';
import {$, ready, registerServiceWorker} from './std-js/functions.js';
import {confirm} from './std-js/asyncDialog.js';
import {login, loginWithCreds, loginHandler, logoutHandler, loadImports, emailSubmitHandler, setTableData, isLoggedIn} from './functions.js';
registerServiceWorker(document.documentElement.dataset.serviceWorker).catch(console.error);
window.isLoggedIn = isLoggedIn;

window.addEventListener('popstate', async event => {
	if (isLoggedIn()) {
		setTableData(event.state);
	} else {
		history.replaceState({}, document.title, location.pathname);
	}
});

ready().then(async () => {
	const $docEl = $(document.documentElement);
	const $doc = $(document);
	const $loading = $('#loading-dialog');

	$docEl.replaceClass('no-js', 'js');
	$docEl.toggleClass('no-dialog', document.createElement('dialog') instanceof HTMLUnknownElement);
	$loading.showModal();

	await loadImports();

	if (! navigator.onLine) {
		$('[type="submit"]').disable();
		$docEl.addClass('offline');
	}

	addEventListener('online', () => {
		$docEl.removeClass('offline');
		$('[type="submit"]').enable();
	});

	addEventListener('offline', () => {
		$docEl.addClass('offline');
		$('[type="submit"]').disable();
	});

	$doc.on('logout', logoutHandler);
	$doc.on('login', loginHandler);

	$('[data-click="login"]').click(async () => {
		if (! await loginWithCreds()) {
			$('#login-dialog').showModal();
		}
	});

	$('[data-click="logout"]').click(async () => {
		if (await confirm('Are you sure you want to sign out?')) {
			document.dispatchEvent(new CustomEvent('logout'));
		}
	});

	$('[data-click="register"]').click(() => $('#registration-dialog').showModal());


	document.forms.login.addEventListener('submit', async event => {
		event.preventDefault();
		const dialog = event.target.closest('dialog');
		const data = Object.fromEntries(new FormData(event.target).entries());
		if (dialog instanceof HTMLElement) {
			dialog.close();
		}
		try {
			await login(data);
			event.target.reset();
			$('dialog[open]').close();
		} catch (err) {
			console.error(err);
			await $('dialog[open]').close();
			dialog.showModal();
			await $(dialog).shake({duration: 150, iterations: 3});
			event.target.querySelector('input:not([type="hidden"])').focus();
		}
	});

	document.forms.sendEmail.addEventListener('submit', emailSubmitHandler);

	$('dialog form').reset(event => event.target.closest('dialog').close());

	if (isLoggedIn()) {
		document.dispatchEvent(new CustomEvent('login'));
	} else {
		$('[data-click="login"], [data-click="register"]').unhide();
	}
	$loading.close();
});
