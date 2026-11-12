// בדיקת עשן: מריצה את הגאדג'ט ב-Chromium מול סביבת MediaWiki מדומה (mwstub.js) ו-OOUI אמיתי.
// יוצאת עם קוד שגיאה אם בדיקה כלשהי נכשלה.
// Playwright מותקן גלובלית (npm install -g playwright); לא כתלות מקומית, כדי שגרסת הדפדפן תתאים
const { chromium } = require( 'playwright' );
const path = require( 'path' );

const NM = path.join( __dirname, 'node_modules' );
const SRC = path.join( __dirname, '../src/' );
const DOCS = path.join( __dirname, '../docs/' );
const ORIGIN = 'http://test.local';

const svg = ( c ) => `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="160"><rect width="220" height="160" fill="${ c }"/><circle cx="110" cy="80" r="40" fill="#fff8"/></svg>`;

const CAPTCHA_HTML = {
	none: '',
	question: '<div class="captcha"><p><label for="wpCaptchaWord">כמה זה שלוש ועוד ארבע?</label> <input name="wpCaptchaWord" id="wpCaptchaWord"></p><input type="hidden" name="wpCaptchaId" value="12345"></div>',
	hcaptcha: '<div class="captcha"><div id="h-captcha" class="h-captcha" data-sitekey="SITEKEY-1"></div>' +
		'<div class="h-captcha-noscript-container"><div class="cdx-message cdx-message--error">נדרש JavaScript</div></div></div>',
};
const contactForm = ( captcha, error ) => `<html><body><div id="mw-content-text">
${ error ? `<div class="cdx-message cdx-message--error">${ error }</div>` : '' }
<form method="post" action="/w/index.php?title=Special:Contact">
<input name="wpFromName" value="Tester"><input name="wpFromAddress" type="email" value="tester@example.org"><input name="wpSubject" value="פנייה מהאתר">
<textarea name="wpText"></textarea><input type="checkbox" name="wpCCme" value="1" checked>
${ CAPTCHA_HTML[ captcha ] }
<input type="hidden" name="wpEditToken" value="+\\"><input type="hidden" name="title" value="Special:Contact"><input type="hidden" name="wpFormIdentifier" value="contactpage"><button type="submit" name="x">שליחה</button></form></div></body></html>`;
const CONTACT_OK = '<html><body><h1 id="firstHeading">הדואר נשלח</h1><div id="mw-content-text"><p>ההודעה נשלחה.</p><p id="mw-returnto">חזרה לעמוד הראשי</p></div></body></html>';
const CONTACT_ERROR_PAGE = '<html><body><div id="mw-content-text"><p>שליחת דוא"ל מושבתת באתר זה.</p></div></body></html>';

// סקריפט hCaptcha מדומה: מציג רכיב, והבדיקה קוראת ל-callback בעצמה דרך window.__hc
const FAKE_HCAPTCHA = `window.hcaptcha = {
	render( el, opts ) { el.innerHTML = '<div style="width:300px;height:74px;border:1px solid #d3d3d3;background:#f9f9f9;display:flex;align-items:center;justify-content:center;font:14px sans-serif">hCaptcha (מדומה)</div>'; window.__hc = { el, opts, resets: 0 }; return 'w1'; },
	reset( id ) { window.__hc.resets++; }
};`;

const BASE_CONFIG = {
	wgNamespaceNumber: 0, wgAction: 'view', wgArticleId: 10, wgPageName: 'אלברט_איינשטיין',
	wgRevisionId: 4242, wgCurRevisionId: 4242, wgArticlePath: '/wiki/$1', wgUserName: 'Tester',
};

function articleHtml( config ) {
	const isFile = config.wgNamespaceNumber === 6;
	const content = isFile ?
		'<div id="file"><a href="/w/upload/michlol/a/ab/Einstein_1921.jpg"><img src="/w/upload/michlol/a/ab/Einstein_1921.jpg" width="220" height="160"></a></div><div id="mw-content-text"><p>תיאור הקובץ</p></div>' :
		`<div id="mw-content-text">
<p>טקסט הערך <img src="/w/upload/michlol/1/1a/Icon.svg" width="16" height="16"></p>
<a href="/wiki/%D7%A7%D7%95%D7%91%D7%A5:Einstein_1921.jpg" class="mw-file-description"><img src="/w/upload/michlol/thumb/a/ab/Einstein_1921.jpg/220px-Einstein_1921.jpg" width="220" height="160"></a>
<a href="/wiki/%D7%A7%D7%95%D7%91%D7%A5:Einstein_family.jpg" class="mw-file-description"><img src="/w/upload/michlol/thumb/c/cd/Einstein_family.jpg/220px-Einstein_family.jpg" width="220" height="160"></a>
<a href="/wiki/%D7%A7%D7%95%D7%91%D7%A5:Einstein_family.jpg" class="mw-file-description"><img src="/w/upload/michlol/thumb/c/cd/Einstein_family.jpg/120px-Einstein_family.jpg" width="120" height="90"></a>
<a href="/wiki/Other"><img src="/w/upload/michlol/e/ef/Map.png" width="220" height="160"></a>
</div>`;
	const css = [ 'core', 'windows', 'images', 'icons-alerts', 'icons-interactions' ].map( ( n ) => n.startsWith( 'icons' ) ?
		`<link rel="stylesheet" href="/nm/oojs-ui/dist/oojs-ui-wikimediaui-${ n }.rtl.css">` :
		`<link rel="stylesheet" href="/nm/oojs-ui/dist/oojs-ui-${ n }-wikimediaui.rtl.css">` ).join( '' );
	// בכוונה בלי oojs-ui-widgets: הגאדג'ט צריך להסתפק ב-core וב-windows
	return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">${ css }
<link rel="stylesheet" href="/src/Gadget-feedback.css">
<style>body{font-family:sans-serif;margin:0}.mw-body{padding:20px}</style>
<script>window.MWCONFIG=${ JSON.stringify( config ) };</script>
<script src="/nm/jquery/dist/jquery.js"></script><script src="/nm/oojs/dist/oojs.js"></script>
<script src="/nm/oojs-ui/dist/oojs-ui-core.js"></script><script src="/nm/oojs-ui/dist/oojs-ui-windows.js"></script>
<script src="/nm/oojs-ui/dist/oojs-ui-wikimediaui.js"></script>
<script src="/mwstub.js"></script></head><body>
<div class="mw-body"><h1>${ config.wgPageName.replace( /_/g, ' ' ) }</h1>${ content }</div>
<script src="/src/Gadget-feedback.js"></script></body></html>`;
}

/* ---------- תשתית ---------- */

let browser;
const results = [];

async function openPage( opts ) {
	opts = opts || {};
	const config = Object.assign( {}, BASE_CONFIG, opts.config );
	const ctx = await browser.newContext( { viewport: { width: 1000, height: 900 }, deviceScaleFactor: 2 } );
	ctx.setDefaultTimeout( 5000 );
	const p = await ctx.newPage();
	const env = { p, ctx, errors: [], posts: [], contactGets: 0, contact: opts.contact || 'none', postResponses: opts.postResponses || [] };
	p.on( 'pageerror', ( e ) => env.errors.push( e.message ) );
	p.on( 'console', ( m ) => { if ( m.type() === 'error' || m.type() === 'warning' ) env.errors.push( m.text() ); } );
	await p.route( '**/*', async ( route ) => {
		const req = route.request();
		const u = new URL( req.url() );
		const pn = decodeURIComponent( u.pathname );
		if ( u.hostname === 'js.hcaptcha.com' ) return route.fulfill( { contentType: 'text/javascript', body: FAKE_HCAPTCHA } );
		if ( u.origin !== ORIGIN ) return route.fulfill( { status: 404, body: '' } );
		if ( pn === '/article' ) return route.fulfill( { contentType: 'text/html', body: articleHtml( config ) } );
		if ( pn.startsWith( '/nm/' ) ) return route.fulfill( { path: path.join( NM, pn.slice( 4 ) ) } );
		if ( pn.startsWith( '/src/' ) ) return route.fulfill( { path: path.join( SRC, pn.slice( 5 ) ) } );
		if ( pn === '/mwstub.js' ) return route.fulfill( { path: path.join( __dirname, 'mwstub.js' ) } );
		if ( pn.startsWith( '/w/upload/' ) ) return route.fulfill( { contentType: 'image/svg+xml', body: svg( pn.includes( 'family' ) ? '#7a9' : pn.includes( 'Map' ) ? '#c96' : '#69c' ) } );
		if ( pn === '/wiki/Special:Contact' ) {
			env.contactGets++;
			return route.fulfill( { contentType: 'text/html', body: env.contact === 'errorpage' ? CONTACT_ERROR_PAGE : contactForm( env.contact ) } );
		}
		if ( pn === '/w/index.php' && req.method() === 'POST' ) {
			env.posts.push( new URLSearchParams( req.postData() ) );
			const r = env.postResponses.shift() || 'ok';
			return route.fulfill( { contentType: 'text/html', body: r === 'ok' ? CONTACT_OK : contactForm( env.contact, r ) } );
		}
		if ( pn.startsWith( '/wiki/' ) ) return route.fulfill( { contentType: 'text/html', body: '<html><body>דף</body></html>' } );
		return route.fulfill( { status: 404, body: '' } );
	} );
	if ( opts.newSection ) {
		await p.addInitScript( ( r ) => { window.__nsr = r; }, opts.newSection );
	}
	await p.goto( `${ ORIGIN }/article${ opts.query || '' }` );
	await p.evaluate( () => { if ( window.__nsr ) TEST.newSectionResponses = window.__nsr; } );
	return env;
}

const sleep = ( ms ) => new Promise( ( r ) => setTimeout( r, ms ) );
const H = {
	open: async ( p ) => {
		await p.click( '#buttonFeedback a' );
		await p.waitForSelector( '.hm-report-notice', { state: 'visible' } );
		await sleep( 400 );
	},
	type: ( p, label ) => p.click( `.oo-ui-radioOptionWidget:has-text("${ label }")` ),
	text: ( p, value ) => p.fill( '.oo-ui-processDialog-content textarea:not([aria-hidden="true"])', value ),
	anon: ( p ) => p.click( '.oo-ui-fieldLayout:has-text("דיווח אנונימי") input[type=checkbox]' ),
	submitEnabled: async ( p ) => {
		await sleep( 60 );
		return p.$eval( '.oo-ui-processDialog-actions-primary .oo-ui-actionWidget:visible', ( e ) => !e.classList.contains( 'oo-ui-widget-disabled' ) );
	},
	submit: ( p ) => p.click( '.oo-ui-processDialog-actions-primary .oo-ui-actionWidget:visible' ),
	done: ( p ) => p.waitForSelector( '.hm-report-done', { state: 'visible', timeout: 5000 } ),
	errors: async ( p ) => {
		await p.waitForSelector( '.oo-ui-processDialog-errors:not(.oo-ui-element-hidden)', { timeout: 5000 } );
		return {
			text: await p.$eval( '.oo-ui-processDialog-errors', ( e ) => e.innerText ),
			retry: await p.$$eval( '.oo-ui-processDialog-errors-actions .oo-ui-buttonWidget', ( els ) => els.length === 2 && !els[ 1 ].classList.contains( 'oo-ui-element-hidden' ) ),
		};
	},
	calls: ( p ) => p.evaluate( () => TEST.calls ),
	shot: async ( p, name ) => {
		await sleep( 500 );
		await p.screenshot( { path: path.join( DOCS, name ) } );
	},
};

async function test( name, opts, fn ) {
	const failures = [];
	const check = ( cond, what, detail ) => {
		if ( !cond ) failures.push( what + ( detail !== undefined ? ` — ${ JSON.stringify( detail ) }` : '' ) );
	};
	let env;
	try {
		env = await openPage( opts );
		await fn( env.p, check, env );
		check( env.errors.length === 0, 'אין שגיאות בדף/במסוף', env.errors );
	} catch ( e ) {
		failures.push( 'חריגה: ' + e.message.split( '\n' )[ 0 ] );
	}
	if ( env ) await env.ctx.close();
	results.push( { name, failures } );
	console.log( `${ failures.length ? 'FAIL' : 'PASS' }  ${ name }` );
	failures.forEach( ( f ) => console.log( `      ✗ ${ f }` ) );
}

const SIG = ' ~~~~';
const STATUS = '{{מצב|חדש}}';
const EXTRA = { bot: true, watchlist: 'watch' };

/* ---------- הבדיקות ---------- */

( async () => {
	browser = await chromium.launch();

	await test( '(a) מקלדת: פוקוס על הכפתור ו-Enter פותחים את החלון', {}, async ( p, check ) => {
		await p.waitForSelector( '#buttonFeedback a' );
		await p.focus( '#buttonFeedback a' );
		await p.keyboard.press( 'Enter' );
		await p.waitForSelector( '.hm-report-notice', { state: 'visible', timeout: 3000 } );
		check( await p.$eval( '#buttonFeedback a', ( e ) => e.getAttribute( 'title' ) ) === 'דיווח על בעיות בתוכן הדף', 'לכפתור יש title' );
	} );

	await test( '(b) פתיחה וסגירה 5 פעמים: WindowManager אחד ושדות ריקים', {}, async ( p, check ) => {
		for ( let i = 0; i < 5; i++ ) {
			await H.open( p );
			const state = await p.evaluate( () => ( {
				text: $( '.oo-ui-processDialog-content textarea' ).first().val(),
				email: $( 'input[type=email]' ).val(),
				anon: $( '.oo-ui-processDialog-content input[type=checkbox]' ).filter( ( i, e ) => $( e ).closest( '.oo-ui-fieldLayout' ).text().includes( 'דיווח אנונימי' ) ).prop( 'checked' ),
				typeSelected: $( '.oo-ui-radioOptionWidget.oo-ui-optionWidget-selected' ).length,
			} ) );
			check( state.text === '' && state.email === '' && state.anon === false && state.typeSelected === 0, `פתיחה ${ i + 1 }: שדות ריקים`, state );
			await H.type( p, 'טעות' );
			await H.text( p, 'טקסט כלשהו שהוקלד לפני הסגירה' );
			await H.anon( p );
			await p.fill( 'input[type=email]', 'x@y.zz' );
			await p.click( '.oo-ui-processDialog-actions-safe .oo-ui-actionWidget:visible' );
			await sleep( 400 );
		}
		check( await p.$$eval( '.oo-ui-windowManager', ( e ) => e.length ) === 1, 'בדיוק WindowManager אחד' );
	} );

	await test( '(c) כפתור השליחה מושבת: ריק, רווחים, פחות מ-10 תווים, בלי סוג', {}, async ( p, check ) => {
		await H.open( p );
		await H.text( p, 'טקסט ארוך מספיק אבל בלי סוג' );
		check( !await H.submitEnabled( p ), 'מושבת כשלא נבחר סוג' );
		await H.type( p, 'טעות' );
		check( await H.submitEnabled( p ), 'פעיל כשיש סוג וטקסט תקין' );
		await H.text( p, '' );
		check( !await H.submitEnabled( p ), 'מושבת כשהטקסט ריק' );
		await H.text( p, '      \n   ' );
		check( !await H.submitEnabled( p ), 'מושבת כשיש רק רווחים' );
		await H.text( p, '  קצר מדי  ' );
		check( !await H.submitEnabled( p ), 'מושבת בפחות מ-10 תווים (אחרי trim)' );
		await H.text( p, '1234567890' );
		check( await H.submitEnabled( p ), 'פעיל ב-10 תווים' );
	} );

	await test( '(d) נטרול: כותרת, תבנית, קטגוריה וקובץ; קישור רגיל נשאר', {}, async ( p, check ) => {
		await H.open( p );
		await H.type( p, 'טעות' );
		await H.text( p, '  == X ==\n{{תבנית}}\n[[קטגוריה:א]] ו-[[ Category : B]]\n[[קובץ:ב.jpg]] [[File:C.png]] [[תמונה:ד.jpg]]\n[[קישור]] ו-[[קישור|טקסט]]  ' );
		await H.submit( p );
		await H.done( p );
		const calls = await H.calls( p );
		const expected = STATUS + '\n' +
			'<nowiki>=</nowiki>= X ==\n<nowiki>{{</nowiki>תבנית}}\n[[:קטגוריה:א]] ו-[[:Category: B]]\n[[:קובץ:ב.jpg]] [[:File:C.png]] [[:תמונה:ד.jpg]]\n[[קישור]] ו-[[קישור|טקסט]]' + SIG;
		check( calls.length === 1, 'קריאה אחת ל-newSection', calls.length );
		check( calls[ 0 ][ 3 ] === expected, 'ויקיטקסט מדויק', calls[ 0 ][ 3 ] );
	} );

	await test( '(e) תוכן בלתי הולם וטעות: מבנה הוויקיטקסט הישן, בדפים הנכונים, ומסך מעקב', {}, async ( p, check ) => {
		await H.open( p );
		await H.type( p, 'תוכן בלתי הולם' );
		await H.text( p, 'יש כאן תוכן לא ראוי בפסקה השנייה' );
		await H.submit( p );
		await H.done( p );
		await p.click( '.oo-ui-processDialog-actions-safe .oo-ui-actionWidget:visible' );
		await sleep( 400 );
		await H.open( p );
		await H.type( p, 'טעות' );
		await H.text( p, 'שנת הלידה שגויה, צריך 1879' );
		await H.submit( p );
		await H.done( p );
		const calls = await H.calls( p );
		check( calls[ 0 ][ 1 ] === 'המכלול:דיווח על תוכן בלתי הולם', 'דף תוכן בלתי הולם', calls[ 0 ][ 1 ] );
		check( calls[ 0 ][ 2 ] === '[[אלברט איינשטיין]]', 'כותרת עם רווחים', calls[ 0 ][ 2 ] );
		check( calls[ 0 ][ 3 ] === `${ STATUS }\n{{משוב}}\nיש כאן תוכן לא ראוי בפסקה השנייה${ SIG }`, 'ויקיטקסט תוכן בלתי הולם', calls[ 0 ][ 3 ] );
		check( JSON.stringify( calls[ 0 ][ 4 ] ) === JSON.stringify( EXTRA ), 'bot + watchlist', calls[ 0 ][ 4 ] );
		check( calls[ 1 ][ 1 ] === 'המכלול:דיווח על טעויות', 'דף טעויות', calls[ 1 ][ 1 ] );
		check( calls[ 1 ][ 3 ] === `${ STATUS }\nשנת הלידה שגויה, צריך 1879${ SIG }`, 'ויקיטקסט טעות', calls[ 1 ][ 3 ] );
		const links = await p.$$eval( '.hm-report-done a', ( els ) => els.map( ( a ) => decodeURIComponent( a.getAttribute( 'href' ) ) ) );
		check( links.includes( '/wiki/המכלול:דיווח_על_טעויות' ), 'קישור לדף הדיווחים', links );
		check( links.includes( '/wiki/המכלול:דיווח_על_טעויות#אלברט_איינשטיין' ), 'קישור לפסקה', links );
		check( links.includes( '/wiki/Special:Diff/555' ), 'קישור ל-Special:Diff', links );
		check( !await p.$( 'text=PermanentLink' ), 'אין קישור קבוע לגרסה' );
		await H.shot( p, 'done-tracking.png' );
		await Promise.all( [ p.waitForNavigation(), p.click( '.oo-ui-processDialog-actions-primary .oo-ui-actionWidget:visible' ) ] );
		check( decodeURIComponent( p.url() ) === `${ ORIGIN }/wiki/המכלול:דיווח_על_טעויות#אלברט_איינשטיין`, '"מעבר לדיווח" מנווט לפסקה', p.url() );
	} );

	await test( '(f) דחייה מה-API: שגיאה בתוך החלון עם "נסו שוב"; רשת; הרשאות', {
		newSection: [
			{ reject: [ 'internal_api_error_DBQueryError', { error: { code: 'internal_api_error_DBQueryError', info: 'שגיאת מסד נתונים' } } ] },
			{ reject: [ 'http', { xhr: {}, textStatus: 'error', exception: '' } ] },
			{ resolve: { edit: { result: 'Success', newrevid: 556 } } },
		],
	}, async ( p, check ) => {
		await H.open( p );
		await H.type( p, 'טעות' );
		await H.text( p, 'שנת הלידה שגויה, צריך 1879' );
		await H.submit( p );
		let err = await H.errors( p );
		check( err.text.includes( 'שגיאת מסד נתונים' ), 'הודעת ה-API מוצגת', err.text );
		check( err.retry, 'יש כפתור "נסו שוב"' );
		await p.click( '.oo-ui-processDialog-errors-actions .oo-ui-buttonWidget >> nth=1' );
		err = await H.errors( p );
		check( err.text.includes( 'שגיאת תקשורת' ), 'שגיאת רשת מוצגת', err.text );
		check( err.retry, 'יש "נסו שוב" גם בשגיאת רשת' );
		await p.click( '.oo-ui-processDialog-errors-actions .oo-ui-buttonWidget >> nth=1' );
		await H.done( p );
		const calls = await H.calls( p );
		check( calls.length === 3 && calls[ 2 ][ 3 ] === calls[ 0 ][ 3 ], 'הטקסט נשמר בין הניסיונות', calls.length );
	} );

	await test( '(f2) דף מוגן / חסימה: הודעה ברורה עם הצעה לדיווח אנונימי', {
		newSection: [ { reject: [ 'protectedpage', { error: { code: 'protectedpage', info: 'הדף מוגן.' } } ] } ],
	}, async ( p, check ) => {
		await H.open( p );
		await H.type( p, 'טעות' );
		await H.text( p, 'שנת הלידה שגויה, צריך 1879' );
		await H.submit( p );
		const err = await H.errors( p );
		check( err.text.includes( 'הדף מוגן.' ) && err.text.includes( 'דיווח אנונימי' ), 'הודעה עם הצעה לדיווח אנונימי', err.text );
		check( !err.retry, 'בלי "נסו שוב"' );
	} );

	await test( '(g) קאפצ\'ת שאלה בעריכה: השאלה מוצגת והשליחה החוזרת כוללת captchaid/captchaword', {
		newSection: [ { resolve: { edit: { result: 'Failure', captcha: { type: 'question', mime: 'text/html', id: '987', question: '<b>מהי בירת ישראל?</b>' } } } } ],
	}, async ( p, check ) => {
		await H.open( p );
		await H.type( p, 'טעות' );
		await H.text( p, 'שנת הלידה שגויה, צריך 1879' );
		await H.submit( p );
		await p.waitForSelector( '.hm-report-captcha-question p', { state: 'visible' } );
		check( await p.$eval( '.hm-report-captcha-question p', ( e ) => e.textContent ) === 'מהי בירת ישראל?', 'השאלה מוצגת כטקסט' );
		check( !await H.submitEnabled( p ), 'שליחה מושבתת עד שעונים' );
		check( await p.$eval( '.oo-ui-processDialog-content textarea:not([aria-hidden="true"])', ( e ) => e.value ) === 'שנת הלידה שגויה, צריך 1879', 'הטקסט לא אבד' );
		await p.fill( '.hm-report-captcha input', 'ירושלים' );
		check( await H.submitEnabled( p ), 'שליחה פעילה אחרי תשובה' );
		await H.submit( p );
		await H.done( p );
		const calls = await H.calls( p );
		check( calls.length === 2, 'שתי קריאות', calls.length );
		check( calls[ 1 ][ 4 ].captchaid === '987' && calls[ 1 ][ 4 ].captchaword === 'ירושלים', 'captchaid + captchaword', calls[ 1 ][ 4 ] );
		check( calls[ 1 ][ 4 ].bot === true && calls[ 1 ][ 4 ].watchlist === 'watch', 'bot + watchlist נשמרו', calls[ 1 ][ 4 ] );
	} );

	await test( '(g2) hCaptcha בעריכה: הרכיב מוצג והאסימון נשלח כ-captchaword', {
		newSection: [ { resolve: { edit: { result: 'Failure', captcha: { type: 'hcaptcha', mime: 'application/javascript', key: 'SITEKEY-EDIT', error: null } } } } ],
	}, async ( p, check ) => {
		await H.open( p );
		await H.type( p, 'טעות' );
		await H.text( p, 'שנת הלידה שגויה, צריך 1879' );
		await H.submit( p );
		await p.waitForFunction( () => window.__hc );
		check( await p.evaluate( () => window.__hc.opts.sitekey ) === 'SITEKEY-EDIT', 'sitekey מה-API' );
		check( !await H.submitEnabled( p ), 'מושבת לפני אסימון' );
		await p.evaluate( () => window.__hc.opts.callback( 'TOKEN-EDIT' ) );
		check( await H.submitEnabled( p ), 'פעיל אחרי אסימון' );
		await H.submit( p );
		await H.done( p );
		const calls = await H.calls( p );
		check( calls[ 1 ][ 4 ].captchaword === 'TOKEN-EDIT' && !( 'captchaid' in calls[ 1 ][ 4 ] ), 'captchaword=אסימון, בלי captchaid', calls[ 1 ][ 4 ] );
	} );

	await test( '(h) דיווח על תמונה: הדף והקבצים הנכונים', {}, async ( p, check ) => {
		await H.open( p );
		await H.type( p, 'תמונה בעייתית' );
		await sleep( 300 );
		const names = await p.$$eval( '.hm-report-image-name', ( els ) => els.map( ( e ) => e.textContent ) );
		check( JSON.stringify( names ) === JSON.stringify( [ 'Einstein 1921.jpg', 'Einstein family.jpg', 'Map.png' ] ), 'תמונות (בלי סמלים קטנים ובלי כפילויות)', names );
		check( !await H.submitEnabled( p ), 'מושבת בלי תמונה ובלי טקסט' );
		await p.click( '.hm-report-image-name >> text=Einstein family.jpg' );
		await p.click( '.hm-report-image-name >> text=Map.png' );
		check( await H.submitEnabled( p ), 'פעיל עם תמונה מסומנת, בלי טקסט' );
		await H.shot( p, 'form-image-report.png' );
		await H.submit( p );
		await H.done( p );
		const calls = await H.calls( p );
		check( calls[ 0 ][ 1 ] === 'המכלול:בדיקת תמונות', 'דף בדיקת תמונות', calls[ 0 ][ 1 ] );
		const expected = `${ STATUS }\n'''תמונות:''' [[:קובץ:Einstein family.jpg]], [[:קובץ:Map.png]]\n'''סיבה:''' תמונה לא צנועה או בלתי הולמת\n~~~~`;
		check( calls[ 0 ][ 3 ] === expected, 'ויקיטקסט דיווח תמונה', calls[ 0 ][ 3 ] );
	} );

	await test( '(h2) דף קובץ: סוג "תמונה" והקובץ עצמו מסומנים מראש; כותרת עם נקודתיים', {
		config: { wgNamespaceNumber: 6, wgPageName: 'קובץ:Einstein_1921.jpg' },
	}, async ( p, check ) => {
		await H.open( p );
		check( await p.$eval( '.oo-ui-radioOptionWidget.oo-ui-optionWidget-selected', ( e ) => e.textContent ) === 'תמונה בעייתית', 'סוג תמונה נבחר' );
		check( await H.submitEnabled( p ), 'אפשר לשלוח מיד' );
		await H.submit( p );
		await H.done( p );
		const calls = await H.calls( p );
		check( calls[ 0 ][ 2 ] === '[[:קובץ:Einstein 1921.jpg]]', 'כותרת עם נקודתיים', calls[ 0 ][ 2 ] );
		check( calls[ 0 ][ 3 ].includes( "'''תמונות:''' [[:קובץ:Einstein 1921.jpg]]" ), 'הקובץ בדיווח', calls[ 0 ][ 3 ] );
		const links = await p.$$eval( '.hm-report-done a', ( els ) => els.map( ( a ) => decodeURIComponent( a.getAttribute( 'href' ) ) ) );
		check( links.includes( '/wiki/המכלול:בדיקת_תמונות#קובץ:Einstein_1921.jpg' ), 'עוגן לפסקה בדף קובץ', links );
	} );

	await test( '(i) אנונימי עם hCaptcha: POST נכון, בלי newSection', { contact: 'hcaptcha' }, async ( p, check, env ) => {
		await H.open( p );
		await H.type( p, 'טעות' );
		await H.text( p, 'שנת הלידה שגויה, צריך 1879' );
		await H.anon( p );
		await p.waitForFunction( () => window.__hc );
		await p.fill( 'input[type=email]', 'me@example' );
		check( !await H.submitEnabled( p ), 'מושבת: דוא"ל לא תקין ובלי אסימון' );
		await p.fill( 'input[type=email]', 'me@example.com' );
		check( !await H.submitEnabled( p ), 'מושבת לפני אסימון' );
		await p.evaluate( () => window.__hc.opts.callback( 'TOKEN-1' ) );
		check( await H.submitEnabled( p ), 'פעיל אחרי אסימון' );
		await p.evaluate( () => window.__hc.opts[ 'expired-callback' ]() );
		check( !await H.submitEnabled( p ), 'מושבת אחרי פקיעת האסימון' );
		await p.evaluate( () => window.__hc.opts.callback( 'TOKEN-1' ) );
		await H.shot( p, 'form-anonymous.png' );
		await H.submit( p );
		await H.done( p );
		const post = env.posts[ 0 ];
		check( env.posts.length === 1, 'POST אחד', env.posts.length );
		check( post.get( 'h-captcha-response' ) === 'TOKEN-1', 'h-captcha-response', post.get( 'h-captcha-response' ) );
		check( post.get( 'wpFromName' ) === '', 'שם ריק', post.get( 'wpFromName' ) );
		check( post.get( 'wpFromAddress' ) === 'me@example.com' && post.get( 'wpCCme' ) === '1', 'דוא"ל + עותק' );
		check( post.get( 'wpEditToken' ) === '+\\' && post.get( 'wpFormIdentifier' ) === 'contactpage', 'שדות נסתרים נשלחו' );
		check( post.get( 'wpSubject' ) === 'דיווח אנונימי — טעות: אלברט איינשטיין', 'נושא', post.get( 'wpSubject' ) );
		const body = post.get( 'wpText' );
		check( body.includes( 'דף: אלברט איינשטיין' ) && body.includes( `קישור: ${ ORIGIN }/wiki/%D7%90%D7%9C%D7%91%D7%A8%D7%98_%D7%90%D7%99%D7%99%D7%A0%D7%A9%D7%98%D7%99%D7%99%D7%9F` ), 'גוף: שם הדף וקישור', body );
		check( body.includes( 'פרטי הדיווח:\nשנת הלידה שגויה, צריך 1879' ), 'גוף: פרטי הדיווח', body );
		check( !/4242|גרסה|PermanentLink|oldid/.test( body ), 'בלי שורת גרסה', body );
		check( ( await H.calls( p ) ).length === 0, 'לא נקרא newSection' );
		const done = await p.$eval( '.hm-report-done', ( e ) => e.innerText );
		check( done.includes( 'בדוא"ל' ) && done.includes( 'לא פורסם' ) && done.includes( 'me@example.com' ), 'מסך סיום אנונימי', done );
		check( !await p.isVisible( '.oo-ui-processDialog-actions-primary .oo-ui-actionWidget:has-text("מעבר לדיווח")' ), 'אין "מעבר לדיווח"' );
	} );

	await test( '(j) אנונימי — כישלון: השגיאה מוצגת, הטופס נטען מחדש והקאפצ\'ה מתאפסת', {
		contact: 'question', postResponses: [ 'האימות נכשל, נסו שוב.', 'ok' ],
	}, async ( p, check, env ) => {
		await H.open( p );
		await H.type( p, 'טעות' );
		await H.text( p, 'שנת הלידה שגויה, צריך 1879' );
		await H.anon( p );
		await p.waitForSelector( '.hm-report-captcha-question p', { state: 'visible' } );
		check( await p.$eval( '.hm-report-captcha-question p', ( e ) => e.textContent ) === 'כמה זה שלוש ועוד ארבע?', 'שאלת הטופס מוצגת' );
		await p.fill( '.hm-report-captcha input', '8' );
		await H.submit( p );
		const err = await H.errors( p );
		check( err.text.includes( 'האימות נכשל, נסו שוב.' ), 'השגיאה מהתשובה מוצגת', err.text );
		check( !err.text.includes( 'נדרש JavaScript' ), 'בלי הודעת noscript' );
		check( env.contactGets === 2, 'הטופס נטען מחדש', env.contactGets );
		check( await p.$eval( '.hm-report-captcha input', ( e ) => e.value ) === '', 'התשובה נמחקה' );
		check( env.posts[ 0 ].get( 'wpCaptchaWord' ) === '8' && env.posts[ 0 ].get( 'wpCaptchaId' ) === '12345', 'נשלחו wpCaptchaWord/Id' );
		check( env.posts[ 0 ].get( 'wpFromAddress' ) === '' && !env.posts[ 0 ].has( 'wpCCme' ), 'בלי דוא"ל ובלי עותק' );
		await p.click( '.oo-ui-processDialog-errors-actions .oo-ui-buttonWidget >> nth=0' );
		await p.fill( '.hm-report-captcha input', '7' );
		await H.submit( p );
		await H.done( p );
		check( env.posts.length === 2, 'הניסיון השני נשלח', env.posts.length );
	} );

	await test( '(j2) טופס יצירת הקשר לא זמין: ההסבר מוצג והשליחה מושבתת', { contact: 'errorpage' }, async ( p, check ) => {
		await H.open( p );
		await H.type( p, 'טעות' );
		await H.text( p, 'שנת הלידה שגויה, צריך 1879' );
		await H.anon( p );
		await p.waitForSelector( '.hm-report-anon .oo-ui-messageWidget:has-text("מושבתת")', { timeout: 3000 } );
		check( !await H.submitEnabled( p ), 'שליחה מושבתת' );
	} );

	await test( '(k) משתמש לא רשום: "אנונימי" לא מסומן ויש אזהרת IP', { config: { wgUserName: null } }, async ( p, check ) => {
		await H.open( p );
		const anon = await p.$eval( '.oo-ui-fieldLayout:has-text("דיווח אנונימי") input[type=checkbox]', ( e ) => e.checked );
		check( anon === false, 'לא מסומן' );
		const notice = await p.$eval( '.hm-report-notice', ( e ) => ( { text: e.innerText, warning: e.classList.contains( 'oo-ui-flaggedElement-warning' ) } ) );
		check( notice.warning && notice.text.includes( 'IP' ), 'אזהרת IP', notice );
		await H.anon( p );
		await sleep( 300 );
		const text = await p.$eval( '.hm-report-notice', ( e ) => e.innerText );
		check( text.includes( 'בדוא"ל' ) && !text.includes( 'IP' ), 'הסבר אנונימי אחרי סימון', text );
	} );

	await test( '(l) אין כפתור בגרסה ישנה', { config: { wgRevisionId: 4000 } }, async ( p, check ) => {
		await sleep( 500 );
		check( !await p.$( '#buttonFeedback' ), 'אין כפתור' );
	} );

	await test( '(l2) אין כפתור בהשוואת גרסאות (פרמטר diff)', { query: '?diff=4242&oldid=4000' }, async ( p, check ) => {
		await sleep( 500 );
		check( !await p.$( '#buttonFeedback' ), 'אין כפתור' );
	} );

	await browser.close();
	const failed = results.filter( ( r ) => r.failures.length );
	console.log( `\n${ results.length - failed.length }/${ results.length } passed` );
	process.exit( failed.length ? 1 : 0 );
} )().catch( ( e ) => {
	console.error( e );
	process.exit( 1 );
} );
