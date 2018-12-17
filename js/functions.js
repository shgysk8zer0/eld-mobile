import {API, ICONS} from './consts.js';
import {notify, $, getImports} from './std-js/functions.js';
import {TOKEN, DRIVERID} from './consts.private.js';

export async function loadImports() {
	const imports = await getImports();
	imports.forEach(doc => document.body.append(...doc.content.body.children));
}

export async function emailSubmitHandler(event) {
	event.preventDefault();
	const data = Object.fromEntries(new FormData(event.target).entries());
	console.log(data);
	event.target.reset();
	return data;
}

export async function whenOnline() {
	if (! navigator.onLine) {
		await new Promise(resolve => {
			addEventListener('online', () => resolve, {once: true});
		});
	}
}

export async function loginWithCreds() {
	if ('credentials' in navigator && window.PasswordCredential instanceof Function) {
		const creds = await navigator.credentials.get({
			password: true,
			mediation: 'required',
		});
		if (creds instanceof PasswordCredential) {
			return login({
				driver_code: creds.id,
				driver_pin: creds.password,
				store: false,
			});
		} else {
			return false;
		}
	} else {
		return false;
	}
}

export async function login({
	driver_code,
	driver_pin,
	store = true,
} = {}) {
	const url = new URL('driver_signin', API);
	const headers = new Headers();
	const spinner = document.getElementById('loading-dialog');
	headers.set('Content-Type', 'application/json');
	headers.set('Accept', 'application/json');
	spinner.showModal();

	try {
		await whenOnline();
		const resp = await fetch(url, {
			headers,
			method: 'POST',
			mode: 'cors',
			body: JSON.stringify([{driver_code, driver_pin}]),
			cache: 'no-cache',
		});

		if (resp.ok) {
			const json = await resp.json();
			if ('error' in json) {
				throw new Error(`${json.message} [${json.error}]`);
			} else {
				document.dispatchEvent(new CustomEvent('login', {
					detail: {
						driverId: driver_code,
						driverName: json.driversname,
						token: json.token,
						tracking: json.tracking === '1',
					}
				}));

				notify('Login successful', {
					body: `Welcome back, ${json.driversname}`,
					icon: ICONS.AVATAR,
				}).catch(console.error);

				if (store && window.PasswordCredential instanceof Function) {
					const creds = new PasswordCredential({
						id: driver_code,
						name: json.driversname,
						password: driver_pin,
						iconURL: ICONS.AVATAR,
					});
					await navigator.credentials.store(creds);
				}

				return json;
			}
		} else {
			throw new Error(`${resp.url} [${resp.status} ${resp.statusText}]`);
		}
	} catch(err) {
		console.error(err);
	} finally {
		spinner.close();
	}
}

export async function getEldLog({
	driverid  = NaN,
	startDate = null,
	endDate   = new Date(),
	token     = sessionStorage.getItem('token'),
} = {}) {
	const spinner = document.getElementById('loading-dialog');
	const now = new Date().toISOString().split('T')[0];
	if (endDate instanceof Date && startDate === null) {
		startDate = new Date(Date.parse(endDate) - 86400000); // Defaults to 24 hours ago
	}
	const url =  new URL(`r_eldlog/${driverid}/${startDate.toISOString()}/${endDate.toISOString()}/${token}`, API);
	const headers = new Headers();
	headers.set('Accept', 'application/json');
	spinner.showModal();
	await whenOnline();

	try {
		const resp = await fetch(url, {
			headers,
			method: 'GET',
			mode: 'cors',
		});

		if (resp.ok) {
			const json = await resp.json();
			if ('error' in json) {
				throw new Error(`${json.message} [${json.error}]`);
			} else {
				const content = document.getElementById('eld-table-template').content.cloneNode(true);
				const form = document.getElementById('eld-date-search-template').content.cloneNode(true);
				const table = content.querySelector('table');
				const rowTemplate = document.getElementById('eld-row-template').content;
				const rows = json.map(entry => {
					return {
						driverId: parseInt(entry.driverid),
						driver: entry.name,
						datetime: new Date(entry.cdatetime),
						type: entry.alert,
						latitude: parseFloat(entry.latitude),
						longitude: parseFloat(entry.longitude),
						location: entry.location,
						mapLink: new URL(`https://www.google.com/maps/place/${entry.latitude},${entry.longitude}`),
					};
				}).map(entry => {
					const row = rowTemplate.cloneNode(true);
					$('[data-field]', row).each(cell => {
						const prop = cell.dataset.field;
						if (entry.hasOwnProperty(prop)) {
							const val = entry[prop];
							if (val instanceof Date) {
								cell.textContent = val.toLocaleString();
							} else {
								cell.textContent = val;
							}
						}
					});
					$('a', row).attr({href: entry.mapLink.href});

					return row;
				});
				$('input[name="token"]', form).attr({value: token});
				$('input[name="driverid"]', form).attr({value: driverid});
				$('input[name="startDate"]', form).attr({
					value: startDate.toISOString().split('T')[0],
					max: now,
				});
				$('input[name="startDate"]', form).change(event => {
					const input = event.target.form.querySelector('input[name="endDate"]');
					const date = event.target.value;
					if (input.value < date) {
						input.value = date;
					}
					input.min = date;
				}, {
					passive: true,
				});
				$('input[name="endDate"]', form).change(event => {
					const input = event.target.form.querySelector('input[name="startDate"]');
					const date = event.target.value;
					if (input.value > date) {
						input.value = date;
					}
					input.max = event.target.value;
				}, {
					passive: true,
				});
				$('input[name="endDate"]', form).attr({
					value: endDate.toISOString().split('T')[0],
					max: now,
				});
				$('[data-click="email"]', table).click(() => $('#email-dialog').showModal());
				$('form[name="sendEmail"] [name="driverid"]').attr({value: driverid});
				$('form[name="sendEmail"] [name="fromdate"]').attr({value: startDate.toISOString()});
				$('form[name="sendEmail"] [name="thrudate"]').attr({value: endDate.toISOString()});
				$('form[name="sendEmail"] [name="token"]').attr({value: token});
				table.tBodies.item(0).append(...rows);
				$('form', form).submit(async event => {
					event.preventDefault();
					const data = Object.fromEntries(new FormData(event.target).entries());
					data.driverid = parseInt(data.driverid);
					data.startDate = new Date(data.startDate);
					data.endDate = new Date(data.endDate);
					getEldLog(data);
				});
				$('main table, main form').remove();
				document.querySelector('main').append(form, content);
			}
		} else {
			throw new Error(`${resp.url} [${resp.status} ${resp.statusText}]`);
		}
	} finally {
		spinner.close();
	}

}

export function loginHandler(event) {
	if (event.detail !== null && event.detail.hasOwnProperty('token')) {
		sessionStorage.setItem('driverId', event.detail.driverId);
		sessionStorage.setItem('driverName', event.detail.driverName);
		sessionStorage.setItem('token', event.detail.token);
		sessionStorage.setItem('tracking', event.detail.tracking === true ? 'on' : 'off');
	}

	$('dialog[open]').close();
	$('[data-click="login"], [data-click="register"]').hide();
	$('[data-click="logout"]').unhide();
	getEldLog({
		token: TOKEN,
		driverid: DRIVERID,
	});
}

export function logoutHandler() {
	$('[data-click="login"], [data-click="register"]').unhide();
	$('[data-click="logout"]').hide();
	$('main form, main table').remove();
	sessionStorage.clear();
}
