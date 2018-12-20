import {API, ICONS} from './consts.js';
import {notify, $, getImports} from './std-js/functions.js';
import {alert} from './std-js/asyncDialog.js';

export async function loadImports() {
	const imports = await getImports();
	imports.forEach(doc => document.body.append(...doc.content.body.children));
}

export async function emailSubmitHandler(event) {
	event.preventDefault();
	const body = [Object.fromEntries(new FormData(event.target).entries())];
	const url = new URL('m_eldlog', API);
	const headers = new Headers();
	headers.set('Content-Type', 'application/json');
	headers.set('Accept', 'application/json');
	const resp = await fetch(url, {
		mode: 'cors',
		method: 'POST',
		headers,
		body: JSON.stringify(body),
	});

	if (resp.ok) {
		const data = await resp.json();
		if ('error' in data) {
			throw new Error(`${data.message} [${data.error}]`);
		} else {
			console.log(data);
			event.target.reset();
			alert(data.message);
		}
	} else {
		throw new Error(`${resp.url} [${resp.status} ${resp.statusText}]`);
	}
}

export async function whenOnline() {
	if (! navigator.onLine) {
		await new Promise(resolve => {
			addEventListener('online', () => resolve, {once: true});
		});
	}
}

export function isLoggedIn() {
	return sessionStorage.hasOwnProperty('token');
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
	eld = '1',
	store = true,
} = {}) {
	const url = new URL('driver_signin', API);
	const headers = new Headers();
	const spinner = document.getElementById('loading-dialog');
	headers.set('Content-Type', 'application/json');
	headers.set('Accept', 'application/json');
	spinner.showModal();

	await whenOnline();
	const resp = await fetch(url, {
		headers,
		method: 'POST',
		mode: 'cors',
		body: JSON.stringify([{driver_code, driver_pin, eld}]),
		cache: 'no-cache',
	});

	if (resp.ok) {
		const json = await resp.json();
		if ('error' in json) {
			throw new Error(`${json.message} [${json.error}]`);
		} else {
			document.dispatchEvent(new CustomEvent('login', {
				detail: {
					driverCode: driver_code,
					driverId: parseInt(json.driverid),
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
}

export async function setTableData({
	json = [],
	token = sessionStorage.getItem('token'),
	driverid = NaN,
	startDate = null,
	endDate = null,
} = {}) {
	if (typeof driverid === 'string') {
		driverid = parseInt(driverid);
	}
	if (! Number.isNaN(driverid) && isLoggedIn()) {
		const content = document.getElementById('eld-table-template').content.cloneNode(true);
		const form = document.getElementById('eld-date-search-template').content.cloneNode(true);
		const search = document.getElementById('address-search-template').content.cloneNode(true);
		const list = search.querySelector('#locations-list');
		const table = content.querySelector('table');
		const rowTemplate = document.getElementById('eld-row-template').content;
		const now = new Date().toISOString().split('T')[0];

		const data = json.map(entry => {
			return {
				driverId: parseInt(entry.driverid),
				driver: entry.name,
				datetime: new Date(entry.cdatetime),
				duration: entry.triptime.replace(/^00?:?0?/, ''),
				type: entry.alert,
				latitude: parseFloat(entry.latitude),
				longitude: parseFloat(entry.longitude),
				location: entry.location,
				mapLink: new URL(`https://www.google.com/maps/place/${entry.latitude},${entry.longitude}`),
			};
		});

		const rows = data.map(entry => {
			const row = rowTemplate.cloneNode(true);
			$('[data-field]', row).each(cell => {
				const prop = cell.dataset.field;
				if (entry.hasOwnProperty(prop)) {
					const val = entry[prop];
					if (val instanceof Date) {
						cell.textContent = val.toLocaleString();
						if (cell instanceof HTMLTimeElement) {
							cell.dateTime = val.toISOString();
						}
					} else {
						cell.textContent = val;
					}
				}
			});
			$('a', row).attr({href: entry.mapLink.href});

			return row;
		});

		const listOpts = [...new Set(data.map(item => item.location))].filter(item => item !== '').map(item => {
			const opt = document.createElement('option');
			opt.value = item;
			return opt;
		});

		$('form[name="locationSearch"]', search).submit(event => event.preventDefault());
		$('form[name="locationSearch"]', search).reset(event => {
			[...event.target.closest('table').tBodies.item(0).rows].forEach(row => row.hidden = false);
		});

		$('input[type="search"]', search).change(event => {
			const table = event.target.closest('table');
			[...table.tBodies.item(0).rows].forEach(async row => {
				const loc = row.querySelector('[data-field="location"]');
				row.hidden = ! loc.textContent.toLowerCase().includes(event.target.value.toLowerCase());
			});
		}, {
			passive: true,
		});

		$('[data-field="driver"]', content).text(data[0].driver);
		$('input[name="token"]', form).attr({value: token});
		$('input[name="driverid"]', form).attr({value: driverid});
		$('[data-click="email"]', table).click(() => $('#email-dialog').showModal());
		$('form[name="sendEmail"] [name="from_option"]').attr({value: startDate.toISOString()});
		$('form[name="sendEmail"] [name="thru_option"]').attr({value: endDate.toISOString()});
		$('form[name="sendEmail"] [name="token"]').attr({value: token});
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

		$('form', form).submit(async event => {
			event.preventDefault();
			const data = Object.fromEntries(new FormData(event.target).entries());
			data.driverid = parseInt(data.driverid);
			data.startDate = new Date(data.startDate);
			data.endDate = new Date(data.endDate);
			getEldLog(data);
		});

		[...table.tHead.rows].forEach(row => {
			const tr = row.cloneNode(true);
			tr.classList.remove('sticky');
			table.tFoot.append(tr);
		});

		list.append(...listOpts);
		table.caption.append(search);
		table.tBodies.item(0).append(...rows);
		$('main > table, main > form').remove();
		document.querySelector('main').append(content, form);
	}
}

export async function getEldLog({
	driverid  = parseInt(sessionStorage.getItem('driverId')),
	startDate = null,
	endDate   = new Date(),
	token     = sessionStorage.getItem('token'),
} = {}) {
	const spinner = document.getElementById('loading-dialog');
	if (endDate instanceof Date && startDate === null) {
		startDate = new Date(Date.parse(endDate) - 86400000); // Defaults to 24 hours ago
	}
	const url =  new URL(`m_eldlog/${driverid}/${startDate.toISOString()}/${endDate.toISOString()}/${token}`, API);
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
				const here = new URL(location.href);
				here.searchParams.set('from', startDate.toISOString().split('T')[0]);
				here.searchParams.set('to', endDate.toISOString().split('T')[0]);
				history.pushState(
					{json, startDate, endDate, token, driverid,},
					`${document.title} ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
					here.href
				);
				setTableData({json, startDate, endDate, token, driverid}).catch(console.error);
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
		sessionStorage.setItem('driverCode', event.detail.driverCode);
		sessionStorage.setItem('driverId', event.detail.driverId);
		sessionStorage.setItem('driverName', event.detail.driverName);
		sessionStorage.setItem('token', event.detail.token);
		sessionStorage.setItem('tracking', event.detail.tracking === true ? 'on' : 'off');
	}

	$('dialog[open]').close();
	$('[data-click="login"], [data-click="register"]').hide();
	$('[data-click="logout"]').unhide();
	const url = new URL(location.href);
	const startDate = url.searchParams.has('from') ? new Date(url.searchParams.get('from')) : undefined;
	const endDate = url.searchParams.has('to') ? new Date(url.searchParams.get('to')) : new Date();
	if (navigator.onLine) {
		getEldLog({
			token: sessionStorage.getItem('token'),
			startDate,
			endDate,
			driverid: parseInt(sessionStorage.getItem('driverId')),
		});
	} else if (Array.isArray(history.state.json) && history.state.startDate === startDate && history.state.endDate === endDate) {
		setTableData(history.state);
	}
}

export function logoutHandler() {
	$('[data-click="login"], [data-click="register"]').unhide();
	$('[data-click="logout"]').hide();
	$('main form, main table').remove();
	sessionStorage.clear();
	history.pushState({}, document.title, location.pathname);
}
