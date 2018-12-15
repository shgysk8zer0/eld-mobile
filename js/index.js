import './std-js/deprefixer.js';
import './std-js/shims.js';
import {$, ready, registerServiceWorker} from './std-js/functions.js';
import {confirm} from './std-js/asyncDialog.js';
import {login, loginWithCreds, loginHandler, logoutHandler, loadImports, emailSubmitHandler} from './functions.js';
registerServiceWorker(document.documentElement.dataset.serviceWorker).catch(console.error);

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
		const data = Object.fromEntries(new FormData(event.target).entries());
		login(data).then(() => event.target.reset());
	});

	document.forms.sendEmail.addEventListener('submit', emailSubmitHandler);

	$('dialog form').reset(event => event.target.closest('dialog').close());

	if (sessionStorage.hasOwnProperty('driverId')) {
		document.dispatchEvent(new CustomEvent('login'));
	} else {
		$('[data-click="login"], [data-click="register"]').unhide();
	}
	$loading.close();
});
