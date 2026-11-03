/**
 * דיווח על בעיות תוכן — גאדג'ט להמכלול
 *
 * מוסיף כפתור צף (ופריט בתיבת הכלים) לדפי ערכים ולדפי קבצים, שפותח חלון לדיווח על:
 *  - תוכן בלתי הולם  → [[המכלול:דיווח על תוכן בלתי הולם]]
 *  - תמונה בעייתית   → [[המכלול:בדיקת תמונות]]
 *  - טעות             → [[המכלול:דיווח על טעויות]]
 *
 * דיווח רגיל מתפרסם כפסקה חדשה בדף הדיווחים המתאים, והמדווח מקבל קישור למעקב אחריו.
 * דיווח אנונימי נשלח בדוא"ל לצוות דרך טופס יצירת הקשר (הרחבת ContactPage, [[מיוחד:יצירת קשר]])
 * ואינו מתפרסם באתר.
 *
 * פתיחה מסקריפט אחר:
 *   mw.hook( 'userjs.contentReport.ready' ).add( ( report ) => report.open( { type: 'image', files: [ 'קובץ:דוגמה.jpg' ] } ) );
 */
//<nowiki>
( () => {
	'use strict';

	/* ------------------------------------------------------------------ *
	 * הגדרות
	 * ------------------------------------------------------------------ */

	const CONFIG = {
		// מרחבי שם שבהם יוצג הכפתור (0 = ערכים, 6 = קבצים)
		namespaces: [ 0, 6 ],
		// פעולות שבהן יוצג הכפתור
		actions: [ 'view' ],
		// להוסיף גם קישור בתיבת הכלים (נגיש יותר מהכפתור הצף)
		portletLink: true,

		reportTypes: [
			{
				id: 'inappropriate',
				label: 'תוכן בלתי הולם',
				page: 'המכלול:דיווח על תוכן בלתי הולם',
				prefix: '{{משוב}}',
				help: 'נא להימנע מציטוט ישיר של טקסט בעייתי. במקום זאת ציינו את שם הפסקה או צטטו את תחילת המשפט.',
			},
			{
				id: 'image',
				label: 'תמונה בעייתית',
				page: 'המכלול:בדיקת תמונות',
				prefix: '',
				images: true,
				help: 'סמנו את התמונה או התמונות הבעייתיות. אין צורך לתאר את תוכן התמונה.',
			},
			{
				id: 'mistake',
				label: 'טעות',
				page: 'המכלול:דיווח על טעויות',
				prefix: '',
				help: 'ציינו מהי הטעות, באיזו פסקה היא נמצאת, ואם אפשר — מה התיקון הנכון ומקור לכך.',
			},
		],

		// סיבות לבחירה בדיווח על תמונה
		imageReasons: [
			'תמונה לא צנועה או בלתי הולמת',
			'תמונה שאינה קשורה לערך או מזוהה באופן שגוי',
			'חשש להפרת זכויות יוצרים',
			'אחר (פרטו בתוכן הדיווח)',
		],

		statusTemplate: '{{מצב|חדש}}',
		// לסמן את עריכת הדיווח כעריכת בוט (רק למי שיש לו הרשאה, כמו בגרסה הקודמת)
		markAsBot: true,
		// לצרף לדיווח קישור קבוע לגרסת הדף שעליה דווח
		includeRevision: true,
		// משך המעקב אחר דף הדיווחים (אם האפשרות פעילה באתר). null = מעקב קבוע
		watchExpiry: '1 month',
		// תמונות קטנות מזה (בפיקסלים) הן כנראה סמלים, ולא יוצעו לדיווח
		minImageSize: 30,

		contact: {
			// הדף המסביר על יצירת קשר
			infoPage: 'המכלול:יצירת קשר',
			// הדף המיוחד של ההרחבה ContactPage
			specialPage: 'Special:Contact',
			// סוג הטופס ($wgContactConfig), למשל 'report' עבור [[מיוחד:יצירת קשר/report]]. '' = טופס ברירת המחדל
			formType: '',
			// שמות השדות בטופס (HTMLForm מוסיף wp לפני מפתח השדה)
			fields: {
				subject: 'wpSubject',
				text: 'wpText',
				name: 'wpFromName',
				email: 'wpFromAddress',
				ccMe: 'wpCCme',
			},
		},
	};

	mw.messages.set( {
		'hm-report-title': 'דיווח על בעיות תוכן',
		'hm-report-button': 'דיווח על בעיות בתוכן הדף',
		'hm-report-portlet': 'דיווח על בעיה בדף',
		'hm-report-submit': 'שליחה',
		'hm-report-cancel': 'ביטול',
		'hm-report-close': 'סגירה',
		'hm-report-track': 'מעבר לדיווח',
		'hm-report-type-label': 'סוג הדיווח:',
		'hm-report-images-label': 'אילו תמונות?',
		'hm-report-no-images': 'לא נמצאו תמונות בדף. תארו בתוכן הדיווח באיזו תמונה מדובר.',
		'hm-report-reason-label': 'מה הבעיה בתמונה?',
		'hm-report-text-label': 'תוכן הדיווח:',
		'hm-report-text-label-optional': 'פרטים נוספים (רשות):',
		'hm-report-anon-label': 'דיווח אנונימי',
		'hm-report-anon-help': 'הדיווח יישלח בדוא"ל לצוות המכלול דרך טופס יצירת הקשר, ולא יתפרסם באתר ולא יירשם בהיסטוריית הדפים.',
		'hm-report-email-label': 'כתובת דוא"ל לחזרה (רשות):',
		'hm-report-email-help': 'אם תמסרו כתובת, יישלח אליה עותק של הדיווח והצוות יוכל לחזור אליכם. הכתובת לא תתפרסם.',
		'hm-report-email-invalid': 'כתובת הדוא"ל אינה תקינה.',
		'hm-report-captcha-label': 'אימות — נא לענות כדי להוכיח שאינכם רובוט:',
		'hm-report-captcha-refresh': 'אתגר אחר',
		'hm-report-watch-label': 'מעקב אחר הדיווח (הוספת דף הדיווחים לרשימת המעקב)',
		'hm-report-contact-loading': 'טוען את טופס יצירת הקשר…',
		'hm-report-contact-fallback': 'לא ניתן להשלים את האימות מתוך החלון הזה. לאחר הלחיצה על "שליחה" ייפתח טופס יצירת הקשר בלשונית חדשה, עם פרטי הדיווח ממולאים מראש.',
		'hm-report-contact-error': 'טעינת טופס יצירת הקשר נכשלה. אפשר לנסות לשלוח בכל זאת.',
		'hm-report-contact-unavailable': 'לא ניתן לשלוח דיווח אנונימי כרגע.',
		'hm-report-contact-failed': 'שליחת הדיווח האנונימי נכשלה.',
		'hm-report-edit-failed': 'הדיווח לא נשלח.',
		'hm-report-network-error': 'אירעה שגיאת תקשורת. בדקו את החיבור ונסו שוב.',
		'hm-report-generic-error': 'אירעה שגיאה בלתי צפויה. הדיווח לא נשלח.',
		'hm-report-success': 'הדיווח נשלח בהצלחה',
	} );
	const msg = ( key, ...params ) => mw.msg( `hm-report-${ key }`, ...params );

	const DEPENDENCIES = [
		'mediawiki.api',
		'mediawiki.util',
		'mediawiki.Title',
		'mediawiki.user',
		'oojs-ui-core',
		'oojs-ui-widgets',
		'oojs-ui-windows',
		'oojs-ui.styles.icons-alerts',
	];

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const ERROR_SELECTOR = [
		'.errorbox',
		'.cdx-message--error',
		'.mw-message-box-error',
		'.oo-ui-fieldLayout-messages .oo-ui-flaggedElement-error',
	].join( ', ' );

	let api;

	/* ------------------------------------------------------------------ *
	 * כלי עזר
	 * ------------------------------------------------------------------ */

	const absoluteUrl = ( path ) => new URL( path, location.href ).href;

	/** בניית jQuery מרשימה של מחרוזות (כטקסט בלבד) ואלמנטים */
	const $msg = ( ...parts ) => $( '<span>' ).append(
		parts.map( ( part ) => ( typeof part === 'string' ? document.createTextNode( part ) : part ) )
	);

	const $link = ( title, text, href ) => $( '<a>' )
		.attr( { href: href || mw.util.getUrl( title ), target: '_blank' } )
		.text( text || title );

	/** ניתוח HTML במסמך מבודד (בלי להריץ סקריפטים או לטעון תמונות) */
	const parseHtml = ( html ) => new DOMParser().parseFromString( html, 'text/html' );

	const stripTags = ( html ) => parseHtml( html ).body.textContent.trim();

	const getPageTitle = () => mw.Title.newFromText( mw.config.get( 'wgPageName' ) );

	/* ------------------------------------------------------------------ *
	 * איסוף התמונות שבדף
	 * ------------------------------------------------------------------ */

	const fileTitleFromLink = ( a ) => {
		if ( !a || !a.href ) {
			return null;
		}
		let url;
		try {
			url = new URL( a.href, location.href );
		} catch ( e ) {
			return null;
		}
		if ( url.origin !== location.origin ) {
			return null;
		}
		const articlePrefix = mw.config.get( 'wgArticlePath' ).replace( '$1', '' );
		let name = url.searchParams.get( 'title' );
		if ( !name && url.pathname.startsWith( articlePrefix ) ) {
			try {
				name = decodeURIComponent( url.pathname.slice( articlePrefix.length ) );
			} catch ( e ) {
				return null;
			}
		}
		const title = name ? mw.Title.newFromText( name ) : null;
		return title && title.getNamespaceId() === 6 ? title : null;
	};

	const fileTitleFromImg = ( img ) => {
		try {
			return mw.Title.newFromImg( img );
		} catch ( e ) {
			return null;
		}
	};

	/**
	 * @return {Array<{name: string, title: mw.Title, src: string}>}
	 */
	const collectImages = () => {
		const pageTitle = getPageTitle();
		const content = document.getElementById( 'mw-content-text' );

		// בדף קובץ — מדווחים על הקובץ עצמו
		if ( pageTitle.getNamespaceId() === 6 ) {
			const img = document.querySelector( '#file img' ) || ( content && content.querySelector( 'img' ) );
			return [ { name: pageTitle.getPrefixedText(), title: pageTitle, src: img ? img.currentSrc || img.src : '' } ];
		}

		const found = new Map();
		if ( !content ) {
			return [];
		}
		content.querySelectorAll( 'img' ).forEach( ( img ) => {
			const width = img.width || parseInt( img.getAttribute( 'width' ), 10 ) || 0;
			const height = img.height || parseInt( img.getAttribute( 'height' ), 10 ) || 0;
			if ( ( width && width < CONFIG.minImageSize ) || ( height && height < CONFIG.minImageSize ) ) {
				return;
			}
			const title = fileTitleFromLink( img.closest( 'a' ) ) || fileTitleFromImg( img );
			if ( !title ) {
				return;
			}
			const name = title.getPrefixedText();
			if ( !found.has( name ) ) {
				found.set( name, { name, title, src: img.currentSrc || img.src } );
			}
		} );
		return Array.from( found.values() );
	};

	/* ------------------------------------------------------------------ *
	 * בניית תוכן הדיווח
	 * ------------------------------------------------------------------ */

	const buildWikitext = ( report ) => {
		const lines = [ CONFIG.statusTemplate ];
		if ( report.type.prefix ) {
			lines.push( report.type.prefix );
		}
		if ( report.files.length ) {
			lines.push( `'''תמונות:''' ${ report.files.map( ( f ) => `[[:${ f.getPrefixedText() }]]` ).join( ', ' ) }` );
		}
		if ( report.reason ) {
			lines.push( `'''סיבה:''' ${ report.reason }` );
		}
		if ( CONFIG.includeRevision && report.revId ) {
			lines.push( `'''גרסה:''' [[Special:PermanentLink/${ report.revId }|${ report.revId }]]` );
		}
		lines.push( `${ report.text ? `${ report.text } ` : '' }~~~~` );
		return lines.join( '\n' );
	};

	const buildEmailSubject = ( report ) => `דיווח אנונימי — ${ report.type.label }: ${ report.headingText }`;

	const buildEmailText = ( report, includeEmail ) => {
		const lines = [
			`סוג הדיווח: ${ report.type.label }`,
			`דף: ${ report.headingText }`,
			`קישור: ${ report.pageUrl }`,
		];
		if ( report.revId ) {
			lines.push( `גרסה: ${ absoluteUrl( mw.util.getUrl( `Special:PermanentLink/${ report.revId }` ) ) }` );
		}
		if ( report.files.length ) {
			lines.push( 'תמונות:' );
			report.files.forEach( ( f ) => lines.push( `- ${ f.getPrefixedText() } (${ absoluteUrl( f.getUrl() ) })` ) );
		}
		if ( report.reason ) {
			lines.push( `סיבה: ${ report.reason }` );
		}
		if ( includeEmail && report.email ) {
			lines.push( `דוא"ל לחזרה: ${ report.email }` );
		}
		if ( report.text ) {
			lines.push( '', 'פרטי הדיווח:', report.text );
		}
		lines.push( '', '— נשלח באופן אנונימי באמצעות כלי הדיווח באתר.' );
		return lines.join( '\n' );
	};

	/* ------------------------------------------------------------------ *
	 * מצב המשתמש (הרשאות וחסימות)
	 * ------------------------------------------------------------------ */

	let userStatusPromise = null;
	const getUserStatus = () => {
		if ( !userStatusPromise ) {
			userStatusPromise = api.get( {
				action: 'query',
				meta: 'userinfo',
				uiprop: 'rights|blockinfo',
				formatversion: 2,
			} ).then( ( data ) => {
				const info = data.query.userinfo;
				const rights = info.rights || [];
				const fullyBlocked = !!info.blockid && !info.blockpartial;
				return {
					canEdit: rights.includes( 'edit' ) && !fullyBlocked,
					canWatch: rights.includes( 'editmywatchlist' ) && !mw.user.isAnon(),
				};
			} ).catch( () => ( { canEdit: true, canWatch: !mw.user.isAnon() } ) );
		}
		return userStatusPromise;
	};

	/* ------------------------------------------------------------------ *
	 * טופס יצירת הקשר (ContactPage) — להרחבה אין API, ולכן הטופס נטען,
	 * ממולא ונשלח כפי שדפדפן היה שולח אותו.
	 * ------------------------------------------------------------------ */

	const contactTitle = () => CONFIG.contact.specialPage +
		( CONFIG.contact.formType ? `/${ CONFIG.contact.formType }` : '' );

	const findContactForm = ( doc ) => {
		const field = doc.querySelector( `form [name="${ CONFIG.contact.fields.text }"]` );
		return field ? field.closest( 'form' ) : null;
	};

	const collectErrors = ( doc ) => {
		const texts = Array.from( doc.querySelectorAll( ERROR_SELECTOR ) )
			.map( ( el ) => el.textContent.trim() )
			.filter( Boolean );
		return Array.from( new Set( texts ) ).join( '\n' );
	};

	/** סדרת שדות הטופס כמו שדפדפן היה שולח אותם */
	const serializeForm = ( form ) => {
		const params = new URLSearchParams();
		Array.from( form.elements ).forEach( ( el ) => {
			const type = ( el.type || '' ).toLowerCase();
			if ( !el.name || el.disabled || [ 'submit', 'button', 'image', 'reset', 'file' ].includes( type ) ) {
				return;
			}
			if ( ( type === 'checkbox' || type === 'radio' ) && !el.checked ) {
				return;
			}
			if ( el.tagName === 'SELECT' ) {
				Array.from( el.options ).filter( ( o ) => o.selected ).forEach( ( o ) => params.append( el.name, o.value ) );
				return;
			}
			params.append( el.name, el.value );
		} );
		return params;
	};

	/**
	 * @return {Promise<Object>} status: 'ready' | 'fallback' | 'unavailable' | 'error'
	 */
	const fetchContactForm = async () => {
		const res = await fetch( mw.util.getUrl( contactTitle() ), { credentials: 'same-origin' } );
		const doc = parseHtml( await res.text() );
		const form = findContactForm( doc );

		if ( !form ) {
			// יש טופס, אבל עם שדות שונים מהמוגדר — נשלח דרך הדף עצמו
			if ( res.ok && doc.querySelector( '#mw-content-text form[method="post"]' ) ) {
				return { status: 'fallback' };
			}
			// דף שגיאה: חסימה, דרישת כניסה לחשבון, תצורה שגויה וכו'
			const content = doc.querySelector( '#mw-content-text' );
			const text = content ? content.textContent.trim().replace( /\s+/g, ' ' ).slice( 0, 300 ) : '';
			return { status: 'unavailable', message: text || msg( 'contact-unavailable' ) };
		}

		const captchaWord = form.querySelector( '[name="wpCaptchaWord"]' );
		if ( !captchaWord && form.querySelector( '.h-captcha, .cf-turnstile, .g-recaptcha, [data-sitekey]' ) ) {
			// קאפצ'ה שמצריכה JavaScript של צד שלישי — אי אפשר להציג אותה כאן
			return { status: 'fallback' };
		}

		let captcha = null;
		if ( captchaWord ) {
			const box = captchaWord.closest( '.captcha' ) || form;
			const label = form.querySelector( 'label[for="wpCaptchaWord"]' );
			captcha = {
				images: Array.from( box.querySelectorAll( 'img' ) )
					.map( ( img ) => img.getAttribute( 'src' ) )
					.filter( Boolean )
					.map( absoluteUrl ),
				question: label ? label.textContent.trim() : '',
				placeholder: captchaWord.getAttribute( 'placeholder' ) || '',
			};
		}

		const nameInput = form.querySelector( `[name="${ CONFIG.contact.fields.name }"]` );
		return {
			status: 'ready',
			form,
			action: absoluteUrl( form.getAttribute( 'action' ) || res.url ),
			captcha,
			hasEmailField: !!form.querySelector( `[name="${ CONFIG.contact.fields.email }"]` ),
			// אם האתר מגדיר את שם השולח כקבוע, שם המשתמש יצורף לפנייה (גם אם לא יתפרסם)
			nameLocked: !!( nameInput && ( nameInput.disabled || nameInput.readOnly ) && nameInput.value ),
		};
	};

	const contactFallbackUrl = ( report ) => {
		const f = CONFIG.contact.fields;
		const query = {};
		query[ f.subject ] = buildEmailSubject( report );
		query[ f.text ] = buildEmailText( report, false );
		if ( report.email ) {
			query[ f.email ] = report.email;
		}
		return mw.util.getUrl( contactTitle(), query );
	};

	/* ------------------------------------------------------------------ *
	 * חלון הדיווח
	 * ------------------------------------------------------------------ */

	const defineDialog = () => {
		function ReportDialog( config ) {
			ReportDialog.super.call( this, config );
			this.contact = { status: 'idle' };
			this.contactRequest = null;
			this.images = new Map();
			this.trackUrl = null;
			this.canPublish = true;
			this.canWatch = false;
		}
		OO.inheritClass( ReportDialog, OO.ui.ProcessDialog );

		ReportDialog.static.name = 'hmContentReportDialog';
		ReportDialog.static.title = msg( 'title' );
		ReportDialog.static.size = 'medium';
		ReportDialog.static.actions = [
			{ action: 'submit', label: msg( 'submit' ), flags: [ 'primary', 'progressive' ], modes: 'form' },
			{ action: 'cancel', label: msg( 'cancel' ), flags: [ 'safe', 'close' ], modes: 'form' },
			{ action: 'track', label: msg( 'track' ), flags: [ 'primary', 'progressive' ], modes: 'done' },
			{ action: 'cancel', label: msg( 'close' ), flags: [ 'safe', 'close' ], modes: 'done' },
		];

		ReportDialog.prototype.initialize = function () {
			ReportDialog.super.prototype.initialize.apply( this, arguments );

			// סוג הדיווח
			this.typeInput = new OO.ui.RadioSelectInputWidget( {
				options: CONFIG.reportTypes.map( ( t ) => ( { data: t.id, label: t.label } ) ),
			} );
			this.typeField = new OO.ui.FieldLayout( this.typeInput, { label: msg( 'type-label' ), align: 'top' } );

			// תמונות
			this.imagesInput = new OO.ui.CheckboxMultiselectWidget( { classes: [ 'hm-report-images' ] } );
			this.imagesField = new OO.ui.FieldLayout( this.imagesInput, { label: msg( 'images-label' ), align: 'top' } );
			this.noImagesMessage = new OO.ui.MessageWidget( { type: 'warning', inline: true, label: msg( 'no-images' ) } );
			this.reasonInput = new OO.ui.DropdownInputWidget( {
				options: CONFIG.imageReasons.map( ( r ) => ( { data: r, label: r } ) ),
			} );
			this.reasonField = new OO.ui.FieldLayout( this.reasonInput, { label: msg( 'reason-label' ), align: 'top' } );

			// תוכן הדיווח
			this.textInput = new OO.ui.MultilineTextInputWidget( { autosize: true, rows: 3, maxRows: 10 } );
			this.textField = new OO.ui.FieldLayout( this.textInput, { label: msg( 'text-label' ), align: 'top' } );
			this.$textHelp = $( '<div>' ).addClass( 'hm-report-help' );

			// דיווח אנונימי
			this.anonInput = new OO.ui.CheckboxInputWidget();
			this.anonField = new OO.ui.FieldLayout( this.anonInput, {
				label: msg( 'anon-label' ),
				align: 'inline',
				help: msg( 'anon-help' ),
			} );
			this.emailInput = new OO.ui.TextInputWidget( { type: 'email', placeholder: 'name@example.com' } );
			this.emailField = new OO.ui.FieldLayout( this.emailInput, {
				label: msg( 'email-label' ),
				align: 'top',
				help: msg( 'email-help' ),
			} );
			this.captchaInput = new OO.ui.TextInputWidget();
			this.$captchaChallenge = $( '<div>' ).addClass( 'hm-report-captcha' );
			this.captchaRefresh = new OO.ui.ButtonWidget( {
				label: msg( 'captcha-refresh' ),
				framed: false,
				flags: [ 'progressive' ],
			} );
			this.captchaField = new OO.ui.FieldLayout( this.captchaInput, { label: msg( 'captcha-label' ), align: 'top' } );
			this.captchaField.$field.prepend( this.$captchaChallenge ).append( this.captchaRefresh.$element );
			this.contactProgress = new OO.ui.ProgressBarWidget( { progress: false } );
			this.contactMessage = new OO.ui.MessageWidget( { inline: true } );
			this.$anonBox = $( '<div>' ).addClass( 'hm-report-anon' ).append(
				this.contactProgress.$element,
				this.contactMessage.$element,
				this.emailField.$element,
				this.captchaField.$element
			);

			// מעקב
			this.watchInput = new OO.ui.CheckboxInputWidget( { selected: true } );
			this.watchField = new OO.ui.FieldLayout( this.watchInput, { label: msg( 'watch-label' ), align: 'inline' } );

			// הסבר: לאן הדיווח נשלח ואיך עוקבים אחריו
			this.notice = new OO.ui.MessageWidget( { type: 'notice', inline: true, classes: [ 'hm-report-notice' ] } );

			this.formPanel = new OO.ui.PanelLayout( { padded: true, expanded: false } );
			this.formPanel.$element.append(
				this.typeField.$element,
				this.imagesField.$element,
				this.noImagesMessage.$element,
				this.reasonField.$element,
				this.textField.$element,
				this.$textHelp,
				this.anonField.$element,
				this.$anonBox,
				this.watchField.$element,
				this.notice.$element
			);
			this.donePanel = new OO.ui.PanelLayout( { padded: true, expanded: false, classes: [ 'hm-report-done' ] } );
			this.stack = new OO.ui.StackLayout( { items: [ this.formPanel, this.donePanel ], expanded: false } );
			this.$body.append( this.stack.$element );

			const update = () => this.updateState();
			this.typeInput.on( 'change', update );
			this.imagesInput.on( 'select', update );
			this.textInput.on( 'change', update );
			this.emailInput.on( 'change', update );
			this.captchaInput.on( 'change', update );
			this.anonInput.on( 'change', update );
			this.captchaRefresh.on( 'click', () => this.loadContactForm() );
		};

		ReportDialog.prototype.getBodyHeight = function () {
			return this.stack.getCurrentItem().$element.outerHeight( true );
		};

		ReportDialog.prototype.getSetupProcess = function ( data ) {
			data = data || {};
			return ReportDialog.super.prototype.getSetupProcess.call( this, data ).next( function () {
				const status = data.status || { canEdit: true, canWatch: false };
				this.canPublish = status.canEdit;
				this.canWatch = status.canWatch;

				this.stack.setItem( this.formPanel );
				this.actions.setMode( 'form' );
				this.textInput.setValue( '' );
				this.emailInput.setValue( '' );
				this.captchaInput.setValue( '' );
				this.watchInput.setSelected( true );
				this.contact = { status: 'idle' };
				this.contactRequest = null;

				this.populateImages( data.files || [] );
				const isFilePage = getPageTitle().getNamespaceId() === 6;
				const type = data.type || ( isFilePage || ( data.files && data.files.length ) ? 'image' : CONFIG.reportTypes[ 0 ].id );
				this.typeInput.setValue( type );
				this.reasonInput.setValue( CONFIG.imageReasons[ 0 ] );

				// משתמש לא רשום — אנונימי כברירת מחדל, כדי לא לחשוף את כתובת ה-IP.
				// מי שאינו יכול לערוך — רק אנונימי.
				this.anonInput.setSelected( !this.canPublish || mw.user.isAnon() );
				this.anonInput.setDisabled( !this.canPublish );

				this.updateState();
			}, this );
		};

		ReportDialog.prototype.getReadyProcess = function ( data ) {
			return ReportDialog.super.prototype.getReadyProcess.call( this, data ).next( function () {
				this.textInput.focus();
			}, this );
		};

		ReportDialog.prototype.getActionProcess = function ( action ) {
			if ( action === 'submit' ) {
				return new OO.ui.Process( () => this.submit() );
			}
			if ( action === 'track' ) {
				return new OO.ui.Process( function () {
					if ( this.trackUrl ) {
						location.href = this.trackUrl;
					}
					this.close();
				}, this );
			}
			if ( action === 'cancel' ) {
				return new OO.ui.Process( function () {
					this.close();
				}, this );
			}
			return ReportDialog.super.prototype.getActionProcess.call( this, action );
		};

		/* ---------- מצב הטופס ---------- */

		ReportDialog.prototype.populateImages = function ( preselect ) {
			const wanted = preselect
				.map( ( name ) => mw.Title.newFromText( name, 6 ) )
				.filter( Boolean )
				.map( ( t ) => t.getPrefixedText() );
			const images = collectImages();
			this.images = new Map( images.map( ( img ) => [ img.name, img ] ) );
			this.imagesInput.clearItems();
			this.imagesInput.addItems( images.map( ( img ) => new OO.ui.CheckboxMultioptionWidget( {
				data: img.name,
				selected: images.length === 1 || wanted.includes( img.name ),
				label: $( '<span>' ).addClass( 'hm-report-image' ).append(
					img.src ? $( '<img>' ).attr( { src: img.src, alt: '', loading: 'lazy' } ) : null,
					$( '<span>' ).addClass( 'hm-report-image-name' ).text( img.title.getMainText() )
				),
			} ) ) );
		};

		ReportDialog.prototype.getType = function () {
			const id = this.typeInput.getValue();
			return CONFIG.reportTypes.find( ( t ) => t.id === id ) || CONFIG.reportTypes[ 0 ];
		};

		ReportDialog.prototype.isAnonymous = function () {
			return this.anonInput.isSelected();
		};

		ReportDialog.prototype.getSelectedFiles = function () {
			return this.imagesInput.getItems()
				.filter( ( item ) => item.isSelected() )
				.map( ( item ) => this.images.get( item.getData() ) )
				.filter( Boolean )
				.map( ( img ) => img.title );
		};

		ReportDialog.prototype.imagesRequired = function () {
			return !!this.getType().images && this.imagesInput.getItems().length > 0;
		};

		ReportDialog.prototype.isValid = function () {
			if ( this.imagesRequired() ) {
				if ( !this.getSelectedFiles().length ) {
					return false;
				}
			} else if ( !this.textInput.getValue().trim() ) {
				return false;
			}
			if ( this.isAnonymous() ) {
				const contact = this.contact;
				if ( contact.status === 'loading' || contact.status === 'unavailable' ) {
					return false;
				}
				if ( contact.status === 'ready' && contact.captcha && !this.captchaInput.getValue().trim() ) {
					return false;
				}
				const email = this.emailInput.getValue().trim();
				if ( email && !EMAIL_RE.test( email ) ) {
					return false;
				}
			}
			return true;
		};

		ReportDialog.prototype.updateState = function () {
			const type = this.getType();
			const anon = this.isAnonymous();
			const hasImages = this.imagesInput.getItems().length > 0;

			this.imagesField.toggle( !!type.images && hasImages );
			this.noImagesMessage.toggle( !!type.images && !hasImages );
			this.reasonField.toggle( !!type.images );
			this.textField.setLabel( this.imagesRequired() ? msg( 'text-label-optional' ) : msg( 'text-label' ) );
			this.$textHelp.text( type.help || '' );

			this.$anonBox.toggle( anon );
			this.watchField.toggle( !anon && this.canWatch );

			const email = this.emailInput.getValue().trim();
			this.emailField.setErrors( email && !EMAIL_RE.test( email ) ? [ msg( 'email-invalid' ) ] : [] );

			if ( anon && this.contact.status === 'idle' ) {
				// טעינה מוקדמת של הטופס, כדי להציג קאפצ'ה (אם יש) כבר עכשיו
				this.loadContactForm();
			}
			this.updateContactUI();
			this.updateNotice();

			this.actions.setAbilities( { submit: this.isValid() } );
			if ( this.manager ) {
				this.updateSize();
			}
		};

		ReportDialog.prototype.updateContactUI = function () {
			const contact = this.contact;
			this.contactProgress.toggle( contact.status === 'loading' );
			this.captchaField.toggle( contact.status === 'ready' && !!contact.captcha );

			let type = null;
			let label = null;
			if ( contact.status === 'loading' ) {
				type = 'notice';
				label = msg( 'contact-loading' );
			} else if ( contact.status === 'fallback' ) {
				type = 'notice';
				label = msg( 'contact-fallback' );
			} else if ( contact.status === 'error' ) {
				type = 'warning';
				label = msg( 'contact-error' );
			} else if ( contact.status === 'unavailable' ) {
				type = 'error';
				label = contact.message;
			}
			this.contactMessage.toggle( !!label );
			if ( label ) {
				this.contactMessage.setType( type );
				this.contactMessage.setLabel( label );
			}
		};

		ReportDialog.prototype.renderCaptcha = function () {
			const captcha = this.contact.captcha;
			this.$captchaChallenge.empty();
			this.captchaInput.setValue( '' );
			if ( !captcha ) {
				return;
			}
			captcha.images.forEach( ( src ) => {
				$( '<img>' ).attr( { src, alt: '' } ).on( 'load', () => this.updateSize() ).appendTo( this.$captchaChallenge );
			} );
			if ( captcha.question ) {
				$( '<p>' ).text( captcha.question ).appendTo( this.$captchaChallenge );
			}
			this.captchaInput.$input.attr( 'placeholder', captcha.placeholder );
		};

		ReportDialog.prototype.updateNotice = function () {
			const page = this.getType().page;
			const contactLink = $link( CONFIG.contact.infoPage );
			let type = 'notice';
			let label;
			if ( this.isAnonymous() ) {
				label = $msg(
					!this.canPublish ? 'אין באפשרותכם לפרסם דיווחים באתר, ולכן הדיווח יישלח באופן אנונימי. ' : '',
					'הדיווח יישלח בדוא"ל לצוות המכלול (ראו ', contactLink, ') ולא יתפרסם באתר, ולכן לא ניתן יהיה לעקוב אחריו בדף הדיווחים.',
					this.contact.nameLocked ? ' שימו לב: בהגדרות האתר שם המשתמש שלכם מצורף לפנייה (אך אינו מתפרסם).' : ''
				);
			} else if ( mw.user.isAnon() ) {
				type = 'warning';
				label = $msg(
					'הדיווח יפורסם בדף ', $link( page ),
					' וכתובת ה-IP שלכם תופיע בחתימה ובהיסטוריית הדף. כדי להסתיר אותה סמנו "', msg( 'anon-label' ), '".'
				);
			} else {
				label = $msg(
					'הדיווח יפורסם בדף ', $link( page ),
					' ויחתם בשם המשתמש שלכם. לאחר השליחה תקבלו קישור לדיווח, שבו תוכלו לעקוב אחר הטיפול בו ואחר תגובות הצוות.'
				);
			}
			this.notice.setType( type );
			this.notice.setLabel( label );
		};

		/* ---------- טופס יצירת הקשר ---------- */

		ReportDialog.prototype.loadContactForm = async function () {
			const request = {};
			this.contactRequest = request;
			this.contact = { status: 'loading' };
			this.updateState();
			let result;
			try {
				result = await fetchContactForm();
			} catch ( e ) {
				mw.log.error( 'ContentReport: טעינת טופס יצירת הקשר נכשלה', e );
				result = { status: 'error' };
			}
			if ( this.contactRequest === request ) {
				this.contact = result;
				this.renderCaptcha();
				this.updateState();
			}
			return this.contact;
		};

		/* ---------- שליחה ---------- */

		ReportDialog.prototype.getReport = function () {
			const type = this.getType();
			const pageTitle = getPageTitle();
			const ns = pageTitle.getNamespaceId();
			const headingText = pageTitle.getPrefixedText();
			return {
				type,
				text: this.textInput.getValue().trim(),
				files: type.images ? this.getSelectedFiles() : [],
				reason: type.images ? this.reasonInput.getValue() : '',
				email: this.emailInput.getValue().trim(),
				headingText,
				// קישור עם נקודתיים לדפי קבצים וקטגוריות, כדי לא להטמיע תמונה או לקטגר את דף הדיווחים
				heading: `[[${ ns === 6 || ns === 14 ? ':' : '' }${ headingText }]]`,
				revId: mw.config.get( 'wgRevisionId' ),
				pageUrl: absoluteUrl( pageTitle.getUrl() ),
			};
		};

		ReportDialog.prototype.submit = async function () {
			const report = this.getReport();
			try {
				if ( this.isAnonymous() ) {
					await this.sendAnonymously( report );
				} else {
					await this.publish( report );
				}
			} catch ( e ) {
				if ( e instanceof OO.ui.Error ) {
					throw e;
				}
				mw.log.error( 'ContentReport:', e );
				throw new OO.ui.Error( msg( 'generic-error' ), { recoverable: true } );
			}
		};

		/** דיווח רגיל — פסקה חדשה בדף הדיווחים */
		ReportDialog.prototype.publish = async function ( report ) {
			const page = report.type.page;
			const params = {};
			if ( CONFIG.markAsBot ) {
				params.bot = true;
			}
			const watch = this.canWatch && this.watchInput.isSelected();
			if ( watch ) {
				params.watchlist = 'watch';
				if ( CONFIG.watchExpiry ) {
					params.watchlistexpiry = CONFIG.watchExpiry;
				}
			}

			const data = await api.newSection( page, report.heading, buildWikitext( report ), params )
				.catch( ( code, result ) => {
					const known = result && ( result.error || result.errors );
					throw new OO.ui.Error(
						known ? api.getErrorMessage( result ) : msg( 'network-error' ),
						{ recoverable: true }
					);
				} );
			if ( !data || !data.edit || data.edit.result !== 'Success' ) {
				throw new OO.ui.Error( msg( 'edit-failed' ), { recoverable: true } );
			}

			// איתור העוגן המדויק של הפסקה החדשה (גם אם כבר יש בדף פסקה בשם זהה)
			const revId = data.edit.newrevid;
			let anchor = null;
			try {
				const parsed = await api.get( { action: 'parse', oldid: revId, prop: 'sections', formatversion: 2 } );
				const sections = parsed.parse.sections.filter( ( s ) => stripTags( s.line ) === report.headingText );
				if ( sections.length ) {
					anchor = sections[ sections.length - 1 ].anchor;
				}
			} catch ( e ) {
				// לא קריטי — נקשר לדף כולו
			}
			const trackUrl = mw.util.getUrl( page ) + ( anchor ? `#${ mw.util.escapeIdForLink( anchor ) }` : '' );

			this.showDone( $( '<div>' ).append(
				$( '<p>' ).append( $( '<strong>' ).text( `${ msg( 'success' ) }.` ) ),
				$( '<p>' ).append( $msg(
					'הדיווח פורסם בדף ', $link( page ), '. ',
					'ניתן לעקוב אחר הטיפול בו ולראות את תגובות הצוות ', $link( page, 'בפסקת הדיווח', trackUrl ), '.'
				) ),
				watch ? $( '<p>' ).text(
					CONFIG.watchExpiry ?
						'דף הדיווחים נוסף לרשימת המעקב שלכם לתקופה מוגבלת, כך שתראו שם עדכונים על הטיפול.' :
						'דף הדיווחים נוסף לרשימת המעקב שלכם, כך שתראו שם עדכונים על הטיפול.'
				) : null,
				$( '<p>' ).addClass( 'hm-report-small' ).append(
					$link( `Special:Diff/${ revId }`, 'צפייה בשינוי שנשמר' )
				)
			), trackUrl );
		};

		/** דיווח אנונימי — דרך טופס יצירת הקשר */
		ReportDialog.prototype.sendAnonymously = async function ( report ) {
			let contact = this.contact;
			if ( contact.status !== 'ready' && contact.status !== 'fallback' ) {
				contact = await this.loadContactForm();
			}

			if ( contact.status === 'fallback' ) {
				const url = contactFallbackUrl( report );
				window.open( url, '_blank', 'noopener' );
				this.showDone( $( '<div>' ).append(
					$( '<p>' ).text( 'טופס יצירת הקשר נפתח בלשונית חדשה, עם פרטי הדיווח ממולאים מראש.' ),
					$( '<p>' ).append( $msg(
						'כדי להשלים את הדיווח, השלימו שם את האימות ולחצו על כפתור השליחה. אם הלשונית לא נפתחה, ',
						$link( contactTitle(), 'לחצו כאן', url ), '.'
					) )
				), null );
				return;
			}
			if ( contact.status !== 'ready' ) {
				throw new OO.ui.Error( contact.message || msg( 'contact-unavailable' ), { recoverable: contact.status === 'error' } );
			}

			const f = CONFIG.contact.fields;
			const params = serializeForm( contact.form );
			params.set( f.subject, buildEmailSubject( report ) );
			params.set( f.text, buildEmailText( report, !contact.hasEmailField ) );
			if ( params.has( f.name ) ) {
				params.set( f.name, '' );
			}
			if ( contact.hasEmailField ) {
				params.set( f.email, report.email );
			}
			// עותק לשולח — רק אם מסר כתובת
			params.delete( f.ccMe );
			if ( report.email && contact.hasEmailField ) {
				params.set( f.ccMe, '1' );
			}
			if ( contact.captcha ) {
				params.set( 'wpCaptchaWord', this.captchaInput.getValue().trim() );
			}

			let res;
			let doc;
			try {
				res = await fetch( contact.action, { method: 'POST', body: params, credentials: 'same-origin' } );
				doc = parseHtml( await res.text() );
			} catch ( e ) {
				throw new OO.ui.Error( msg( 'network-error' ), { recoverable: true } );
			}

			// הצלחה: הטופס לא מוצג שוב ואין הודעות שגיאה
			const content = doc.querySelector( '#mw-content-text' ) || doc.body;
			if ( res.ok && !findContactForm( doc ) && !content.querySelector( ERROR_SELECTOR ) ) {
				this.showDone( $( '<div>' ).append(
					$( '<p>' ).append( $( '<strong>' ).text( `${ msg( 'success' ) }.` ) ),
					$( '<p>' ).append( $msg(
						'הדיווח נשלח באופן אנונימי בדוא"ל לצוות המכלול, ולא פורסם באתר. ',
						'מסיבה זו לא ניתן לעקוב אחריו בדפי הדיווחים.'
					) ),
					$( '<p>' ).text( report.email ?
						`עותק של הדיווח נשלח לכתובת ${ report.email }. אם יהיה צורך, הצוות יחזור אליכם לכתובת זו.` :
						'לא נמסרה כתובת דוא"ל, ולכן הצוות לא יוכל לעדכן אתכם על הטיפול.' ),
					$( '<p>' ).addClass( 'hm-report-small' ).append( $msg( 'מידע נוסף: ', $link( CONFIG.contact.infoPage ) ) )
				), null );
				return;
			}

			const errors = collectErrors( doc );
			// אסימון וקאפצ'ה חדשים לניסיון הבא
			await this.loadContactForm();
			throw new OO.ui.Error( errors || msg( 'contact-failed' ), { recoverable: true } );
		};

		ReportDialog.prototype.showDone = function ( $content, trackUrl ) {
			this.trackUrl = trackUrl;
			this.donePanel.$element.empty().append( $content );
			this.stack.setItem( this.donePanel );
			this.actions.setMode( 'done' );
			this.actions.get( { actions: 'track' } ).forEach( ( action ) => action.toggle( !!trackUrl ) );
			this.updateSize();
		};

		return ReportDialog;
	};

	/* ------------------------------------------------------------------ *
	 * הפעלה
	 * ------------------------------------------------------------------ */

	const init = () => {
		api = new mw.Api();
		const ReportDialog = defineDialog();
		let windowManager = null;
		let dialog = null;

		const open = async ( data ) => {
			if ( windowManager && windowManager.getCurrentWindow() ) {
				return;
			}
			const status = await getUserStatus();
			if ( !windowManager ) {
				windowManager = new OO.ui.WindowManager();
				$( document.body ).append( windowManager.$element );
				dialog = new ReportDialog();
				windowManager.addWindows( [ dialog ] );
			}
			windowManager.openWindow( dialog, Object.assign( {}, data, { status } ) );
		};

		const button = new OO.ui.ButtonWidget( {
			id: 'buttonFeedback',
			icon: 'speechBubble',
			flags: 'progressive',
			label: msg( 'button' ),
			invisibleLabel: true,
			title: msg( 'button' ),
		} );
		button.on( 'click', () => open() );
		const container = document.querySelector( '.mw-page-container-inner' ) ||
			document.querySelector( '.mw-body' ) || document.body;
		button.$element.appendTo( container );

		if ( CONFIG.portletLink ) {
			const link = mw.util.addPortletLink( 'p-tb', '#', msg( 'portlet' ), 't-content-report', msg( 'button' ) );
			if ( link ) {
				$( link ).on( 'click', ( e ) => {
					e.preventDefault();
					open();
				} );
			}
		}

		mw.hook( 'userjs.contentReport.ready' ).fire( { open } );
	};

	const shouldRun = CONFIG.namespaces.includes( mw.config.get( 'wgNamespaceNumber' ) ) &&
		CONFIG.actions.includes( mw.config.get( 'wgAction' ) ) &&
		mw.config.get( 'wgArticleId' ) > 0;

	if ( shouldRun ) {
		$.when( mw.loader.using( DEPENDENCIES ), $.ready ).then( init );
	}
} )();
//</nowiki>
