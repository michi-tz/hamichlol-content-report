/**
 * דיווח על בעיות תוכן — גאדג'ט להמכלול (MediaWiki:Gadget-feedback.js)
 *
 * כפתור צף בדפי ערכים ובדפי קבצים, שפותח חלון לדיווח על תוכן בלתי הולם, תמונה בעייתית או טעות.
 * דיווח רגיל מתפרסם כפסקה חדשה בדף הדיווחים המתאים.
 * דיווח אנונימי נשלח בדוא"ל לצוות דרך טופס יצירת הקשר (ContactPage) ואינו מתפרסם באתר.
 */
//<nowiki>
( () => {
	'use strict';

	const CONFIG = {
		reportTypes: [
			{ id: 'inappropriate', label: 'תוכן בלתי הולם', page: 'המכלול:דיווח על תוכן בלתי הולם', prefix: '{{משוב}}' },
			{ id: 'image', label: 'תמונה בעייתית', page: 'המכלול:בדיקת תמונות', prefix: '', images: true },
			{ id: 'mistake', label: 'טעות', page: 'המכלול:דיווח על טעויות', prefix: '' },
		],
		imageReasons: [
			'תמונה לא צנועה או בלתי הולמת',
			'תמונה שאינה קשורה לערך או מזוהה באופן שגוי',
			'חשש להפרת זכויות יוצרים',
			'אחר (פרטו בתוכן הדיווח)',
		],
		statusTemplate: '{{מצב|חדש}}',
		minTextLength: 10,
		minImageSize: 30,
		contact: {
			specialPage: 'Special:Contact',
			formType: '', // סוג הטופס ב-$wgContactConfig ('' = טופס ברירת המחדל)
			fields: { subject: 'wpSubject', text: 'wpText', name: 'wpFromName', email: 'wpFromAddress', ccMe: 'wpCCme' },
			infoPage: 'המכלול:יצירת קשר',
		},
		// קאפצ'ות שמוצגות כרכיב: type = edit.captcha.type ב-API, className = מחלקת הרכיב בטופס,
		// script = כתובת הסקריפט (רינדור מפורש), field = שם השדה של האסימון, global = האובייקט שהסקריפט יוצר
		captchaVendors: [
			{ type: 'hcaptcha', className: 'h-captcha', script: 'https://js.hcaptcha.com/1/api.js?render=explicit&hl=he', field: 'h-captcha-response', global: 'hcaptcha' },
			{ type: 'turnstile', className: 'cf-turnstile', script: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&language=he', field: 'cf-turnstile-response', global: 'turnstile' },
			{ type: 'recaptchanocaptcha', className: 'g-recaptcha', script: 'https://www.recaptcha.net/recaptcha/api.js?render=explicit&hl=he', field: 'g-recaptcha-response', global: 'grecaptcha' },
		],
	};

	const DEPENDENCIES = [ 'mediawiki.api', 'mediawiki.util', 'mediawiki.Title', 'oojs-ui-core', 'oojs-ui-windows', 'oojs-ui.styles.icons-alerts' ];
	const PERMISSION_ERRORS = [ 'protectedpage', 'cascadeprotected', 'protectednamespace', 'protectedtitle', 'blocked', 'autoblocked', 'globalblocking-blockedtext', 'permissiondenied', 'noedit', 'noedit-anon', 'writeapidenied', 'readonly' ];
	const ERROR_SELECTOR = '.errorbox, .error, .cdx-message--error, .mw-message-box-error, .oo-ui-fieldLayout-messages .oo-ui-flaggedElement-error';
	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const BUTTON_LABEL = 'דיווח על בעיות בתוכן הדף';
	const ANON_LABEL = 'דיווח אנונימי';
	const SUCCESS = 'הדיווח נשלח בהצלחה.';
	const NETWORK_ERROR = 'אירעה שגיאת תקשורת. בדקו את החיבור ונסו שוב.';

	const getPageTitle = () => mw.Title.newFromText( mw.config.get( 'wgPageName' ) );
	const absoluteUrl = ( url ) => new URL( url, location.href ).href;
	const parseHtml = ( html ) => new DOMParser().parseFromString( html, 'text/html' );
	const $link = ( title, text, href ) => $( '<a>' ).attr( 'href', href || mw.util.getUrl( title ) ).text( text || title );
	/** חיבור מחרוזות (כטקסט בלבד) ואלמנטים */
	const $msg = ( ...parts ) => $( '<span>' ).append( parts.map( ( p ) => ( typeof p === 'string' ? document.createTextNode( p ) : p ) ) );

	/* ---------- תמונות הדף ---------- */

	const collectImages = () => {
		const pageTitle = getPageTitle();
		if ( pageTitle.getNamespaceId() === 6 ) {
			const img = document.querySelector( '#file img' );
			return [ { title: pageTitle, src: img ? img.currentSrc || img.src : '' } ];
		}
		const found = new Map();
		document.querySelectorAll( '#mw-content-text img' ).forEach( ( img ) => {
			const width = img.width || parseInt( img.getAttribute( 'width' ), 10 ) || 0;
			const height = img.height || parseInt( img.getAttribute( 'height' ), 10 ) || 0;
			let title = null;
			try {
				title = mw.Title.newFromImg( img );
			} catch ( e ) {}
			if ( title && width >= CONFIG.minImageSize && height >= CONFIG.minImageSize && !found.has( title.getPrefixedText() ) ) {
				found.set( title.getPrefixedText(), { title, src: img.currentSrc || img.src } );
			}
		} );
		return Array.from( found.values() );
	};

	/* ---------- תוכן הדיווח ---------- */

	/** נטרול כותרות, תבניות, קטגוריות והטמעת קבצים בטקסט המדווח. קישורים נשארים פעילים. */
	const sanitize = ( text ) => text.trim()
		.replace( /^=/gm, '<nowiki>=</nowiki>' )
		.replace( /\{\{/g, '<nowiki>{{</nowiki>' )
		.replace( /\[\[\s*(קטגוריה|category|קובץ|file|תמונה|image)\s*:/gi, '[[:$1:' );

	/** מבנה זהה לגאדג'ט הקודם: {{מצב|חדש}}, תבנית פתיחה, טקסט וחתימה */
	const buildWikitext = ( report ) => {
		const lines = [ CONFIG.statusTemplate ];
		if ( report.type.prefix ) {
			lines.push( report.type.prefix );
		}
		if ( report.type.images ) {
			if ( report.files.length ) {
				lines.push( `'''תמונות:''' ${ report.files.map( ( t ) => `[[:${ t.getPrefixedText() }]]` ).join( ', ' ) }` );
			}
			lines.push( `'''סיבה:''' ${ report.reason }` );
		}
		const text = sanitize( report.text );
		lines.push( text ? `${ text } ~~~~` : '~~~~' );
		return lines.join( '\n' );
	};

	const buildEmail = ( report ) => {
		const lines = [ `סוג הדיווח: ${ report.type.label }`, `דף: ${ report.pageName }`, `קישור: ${ report.pageUrl }` ];
		if ( report.type.images ) {
			if ( report.files.length ) {
				lines.push( 'תמונות:', ...report.files.map( ( t ) => `- ${ t.getPrefixedText() } (${ absoluteUrl( t.getUrl() ) })` ) );
			}
			lines.push( `סיבה: ${ report.reason }` );
		}
		if ( report.text ) {
			lines.push( '', 'פרטי הדיווח:', report.text );
		}
		return { subject: `דיווח אנונימי — ${ report.type.label }: ${ report.pageName }`, text: lines.join( '\n' ) };
	};

	/* ---------- טופס יצירת הקשר: להרחבה אין API, ולכן הטופס נטען ונשלח כמו בדפדפן ---------- */

	const contactTitle = () => CONFIG.contact.specialPage + ( CONFIG.contact.formType ? `/${ CONFIG.contact.formType }` : '' );

	const findContactForm = ( doc ) => {
		const field = doc.querySelector( `form [name="${ CONFIG.contact.fields.text }"]` );
		return field ? field.closest( 'form' ) : null;
	};

	const collectErrors = ( doc ) => {
		const texts = Array.from( ( doc.querySelector( '#mw-content-text' ) || doc.body ).querySelectorAll( ERROR_SELECTOR ) )
			.filter( ( el ) => !el.closest( 'noscript, .h-captcha-noscript-container' ) )
			.map( ( el ) => el.textContent.trim() )
			.filter( Boolean );
		return Array.from( new Set( texts ) ).join( '\n' );
	};

	const serializeForm = ( form ) => {
		const params = new URLSearchParams();
		Array.from( form.elements ).forEach( ( el ) => {
			const type = ( el.type || '' ).toLowerCase();
			if ( !el.name || el.disabled || [ 'submit', 'button', 'image', 'reset', 'file' ].includes( type ) ||
				( ( type === 'checkbox' || type === 'radio' ) && !el.checked ) ) {
				return;
			}
			if ( el.tagName === 'SELECT' ) {
				Array.from( el.selectedOptions ).forEach( ( o ) => params.append( el.name, o.value ) );
			} else {
				params.append( el.name, el.value );
			}
		} );
		return params;
	};

	const fetchContactForm = async () => {
		const res = await fetch( mw.util.getUrl( contactTitle() ), { credentials: 'same-origin' } );
		const doc = parseHtml( await res.text() );
		const form = findContactForm( doc );
		if ( !form ) {
			// דף שגיאה: חסימה, דרישת כניסה לחשבון, שליחת דוא"ל מושבתת וכו'
			const content = doc.querySelector( '#mw-content-text' );
			const text = content ? content.textContent.trim().replace( /\s+/g, ' ' ).slice( 0, 300 ) : '';
			return { status: 'unavailable', message: text || 'לא ניתן לשלוח דיווח אנונימי כרגע.' };
		}
		let captcha = null;
		const word = form.querySelector( '[name="wpCaptchaWord"]' );
		if ( word ) {
			const label = form.querySelector( 'label[for="wpCaptchaWord"]' );
			const img = ( word.closest( '.captcha' ) || form ).querySelector( 'img[src]' );
			captcha = { mode: 'question', text: label ? label.textContent.trim() : '', image: img ? absoluteUrl( img.getAttribute( 'src' ) ) : '' };
		} else {
			CONFIG.captchaVendors.some( ( vendor ) => {
				const el = form.querySelector( `.${ vendor.className }[data-sitekey]` );
				captcha = el ? { mode: 'widget', vendor, key: el.getAttribute( 'data-sitekey' ) } : null;
				return !!captcha;
			} );
		}
		return { status: 'ready', form, captcha, action: absoluteUrl( form.getAttribute( 'action' ) || res.url ) };
	};

	/* ---------- רכיב אימות (קאפצ'ה) אחד, לעריכה ולטופס יצירת הקשר ---------- */

	const vendorScripts = {};
	const loadVendor = ( vendor ) => {
		if ( !vendorScripts[ vendor.global ] ) {
			vendorScripts[ vendor.global ] = new Promise( ( resolve, reject ) => {
				mw.loader.getScript( vendor.script ).then( () => {
					let tries = 0;
					const check = () => {
						const api = window[ vendor.global ];
						if ( api && typeof api.render === 'function' ) {
							resolve( api );
						} else if ( ++tries > 100 ) {
							reject( new Error( `${ vendor.global } not ready` ) );
						} else {
							setTimeout( check, 100 );
						}
					};
					check();
				}, () => reject( new Error( `${ vendor.script } failed to load` ) ) );
			} );
			vendorScripts[ vendor.global ].catch( () => delete vendorScripts[ vendor.global ] );
		}
		return vendorScripts[ vendor.global ];
	};

	/** שני מצבים: 'question' (שאלה/תמונה ושדה תשובה) ו-'widget' (רכיב של ספק חיצוני שמחזיר אסימון) */
	function Captcha( onChange ) {
		this.onChange = onChange;
		this.input = new OO.ui.TextInputWidget();
		this.input.on( 'change', onChange );
		this.$question = $( '<div>' ).addClass( 'hm-report-captcha-question' );
		this.$widget = $( '<div>' ).addClass( 'hm-report-captcha-widget' );
		this.note = new OO.ui.MessageWidget( { inline: true } );
		this.field = new OO.ui.FieldLayout( this.input, { label: 'אימות — נא לענות כדי להוכיח שאינכם רובוט:', align: 'top' } );
		this.field.$field.prepend( this.$question );
		this.$element = $( '<div>' ).addClass( 'hm-report-captcha' ).append( this.note.$element, this.field.$element, this.$widget );
		this.clear();
	}

	Captcha.prototype.clear = function () {
		this.mode = null;
		this.token = '';
		this.rendered = null;
		this.input.setValue( '' );
		this.$widget.empty();
		this.$element.hide();
	};

	Captcha.prototype.setNote = function ( text, type ) {
		this.note.toggle( !!text );
		this.note.setType( type || 'notice' );
		this.note.setLabel( text || '' );
	};

	Captcha.prototype.showQuestion = function ( text, image ) {
		this.clear();
		this.mode = 'question';
		this.$question.empty().append(
			image ? $( '<img>' ).attr( { src: image, alt: '' } ).on( 'load', this.onChange ) : null,
			text ? $( '<p>' ).text( text ) : null
		);
		this.field.toggle( true );
		this.$element.show();
		this.onChange();
	};

	Captcha.prototype.showWidget = async function ( vendor, key ) {
		if ( this.rendered && this.rendered.vendor === vendor && this.rendered.key === key ) {
			this.reset();
			return;
		}
		this.clear();
		this.mode = 'widget';
		this.field.toggle( false );
		this.$element.show();
		const target = $( '<div>' ).appendTo( this.$widget )[ 0 ];
		const setToken = ( token ) => {
			this.token = token || '';
			this.onChange();
		};
		try {
			const api = await loadVendor( vendor );
			if ( target.isConnected ) {
				const id = api.render( target, {
					sitekey: key,
					callback: setToken,
					'expired-callback': () => setToken( '' ),
					'error-callback': () => setToken( '' ),
				} );
				this.rendered = { vendor, key, api, id };
			}
		} catch ( e ) {
			mw.log.error( 'feedback: captcha', e );
			this.setNote( 'טעינת רכיב האימות נכשלה. נסו לסגור את החלון ולפתוח אותו שוב.', 'error' );
		}
		this.onChange();
	};

	Captcha.prototype.reset = function () {
		this.token = '';
		this.input.setValue( '' );
		if ( this.rendered ) {
			try {
				this.rendered.api.reset( this.rendered.id );
			} catch ( e ) {
				mw.log.error( 'feedback: captcha reset', e );
			}
		}
		this.onChange();
	};

	Captcha.prototype.getAnswer = function () {
		return this.mode === 'widget' ? this.token : this.input.getValue().trim();
	};

	/* ---------- חלון הדיווח ---------- */

	const defineDialog = ( api ) => {
		function ReportDialog( config ) {
			ReportDialog.super.call( this, config );
			this.images = [];
			this.contact = { status: 'idle' };
		}
		OO.inheritClass( ReportDialog, OO.ui.ProcessDialog );

		ReportDialog.static.name = 'hmReportDialog';
		ReportDialog.static.title = 'דיווח על בעיות תוכן';
		ReportDialog.static.size = 'medium';
		ReportDialog.static.actions = [
			{ action: 'submit', label: 'שליחה', flags: [ 'primary', 'progressive' ], modes: 'form' },
			{ action: 'cancel', label: 'ביטול', flags: [ 'safe', 'close' ], modes: 'form' },
			{ action: 'track', label: 'מעבר לדיווח', flags: [ 'primary', 'progressive' ], modes: 'done' },
			{ action: 'cancel', label: 'סגירה', flags: [ 'safe', 'close' ], modes: 'done' },
		];

		ReportDialog.prototype.initialize = function () {
			ReportDialog.super.prototype.initialize.apply( this, arguments );
			const update = () => this.updateState();
			const field = ( widget, label, extra ) => new OO.ui.FieldLayout( widget, Object.assign( { label, align: 'top' }, extra ) );

			this.typeSelect = new OO.ui.RadioSelectWidget( {
				items: CONFIG.reportTypes.map( ( t ) => new OO.ui.RadioOptionWidget( { data: t.id, label: t.label } ) ),
			} );
			this.imagesInput = new OO.ui.CheckboxMultiselectWidget( { classes: [ 'hm-report-images' ] } );
			this.imagesField = field( this.imagesInput, 'אילו תמונות?' );
			this.noImages = new OO.ui.MessageWidget( { type: 'warning', inline: true, label: 'לא נמצאו תמונות בדף. תארו בתוכן הדיווח באיזו תמונה מדובר.' } );
			this.reasonInput = new OO.ui.DropdownInputWidget( { options: CONFIG.imageReasons.map( ( r ) => ( { data: r, label: r } ) ) } );
			this.reasonField = field( this.reasonInput, 'מה הבעיה בתמונה?' );
			this.textInput = new OO.ui.MultilineTextInputWidget( { autosize: true, rows: 3, maxRows: 10 } );
			this.textField = field( this.textInput, '', {
				help: 'נא להימנע מציטוט ישיר של תוכן פוגעני — ציינו את שם הפסקה או את תחילת המשפט.',
				helpInline: true,
			} );
			this.anonInput = new OO.ui.CheckboxInputWidget();
			this.emailInput = new OO.ui.TextInputWidget( { type: 'email', placeholder: 'name@example.com' } );
			this.emailField = field( this.emailInput, 'כתובת דוא"ל לחזרה (רשות):', {
				help: 'אם תמסרו כתובת, יישלח אליה עותק של הדיווח והצוות יוכל לחזור אליכם. הכתובת לא תתפרסם.',
				helpInline: true,
			} );
			this.contactMessage = new OO.ui.MessageWidget( { inline: true } );
			this.$anonBox = $( '<div>' ).addClass( 'hm-report-anon' ).append( this.contactMessage.$element, this.emailField.$element );
			this.captcha = new Captcha( update );
			this.notice = new OO.ui.MessageWidget( { inline: true, classes: [ 'hm-report-notice' ] } );

			this.formPanel = new OO.ui.PanelLayout( { padded: true, expanded: false } );
			this.formPanel.$element.append(
				field( this.typeSelect, 'סוג הדיווח:' ).$element,
				this.imagesField.$element,
				this.noImages.$element,
				this.reasonField.$element,
				this.textField.$element,
				new OO.ui.FieldLayout( this.anonInput, { label: ANON_LABEL, align: 'inline' } ).$element,
				this.$anonBox,
				this.captcha.$element,
				this.notice.$element
			);
			this.donePanel = new OO.ui.PanelLayout( { padded: true, expanded: false, classes: [ 'hm-report-done' ] } );
			this.$body.append( this.formPanel.$element, this.donePanel.$element );

			this.typeSelect.on( 'select', update );
			this.imagesInput.on( 'select', update );
			this.textInput.on( 'change', update );
			this.emailInput.on( 'change', update );
			this.anonInput.on( 'change', () => this.onAnonChange() );
		};

		ReportDialog.prototype.getBodyHeight = function () {
			return ( this.donePanel.isVisible() ? this.donePanel : this.formPanel ).$element.outerHeight( true );
		};

		ReportDialog.prototype.getSetupProcess = function ( data ) {
			return ReportDialog.super.prototype.getSetupProcess.call( this, data ).next( function () {
				const isFilePage = getPageTitle().getNamespaceId() === 6;
				this.contact = { status: 'idle' };
				this.contactRequest = this.editCaptcha = this.trackUrl = null;
				this.captcha.clear();
				this.captcha.setNote( '' );
				this.formPanel.toggle( true );
				this.donePanel.toggle( false );
				this.actions.setMode( 'form' );
				this.images = collectImages();
				this.imagesInput.clearItems().addItems( this.images.map( ( img, i ) => new OO.ui.CheckboxMultioptionWidget( {
					data: i,
					selected: isFilePage,
					label: $( '<span>' ).addClass( 'hm-report-image' ).append(
						img.src ? $( '<img>' ).attr( { src: img.src, alt: '' } ) : null,
						$( '<span>' ).addClass( 'hm-report-image-name' ).text( img.title.getMainText() )
					),
				} ) ) );
				// אין סוג ברירת מחדל, חוץ מדף קובץ
				this.typeSelect.selectItem( isFilePage ? this.typeSelect.findItemFromData( 'image' ) : null );
				this.reasonInput.setValue( CONFIG.imageReasons[ 0 ] );
				this.textInput.setValue( '' );
				this.emailInput.setValue( '' );
				this.anonInput.setSelected( false );
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
			if ( action ) {
				return new OO.ui.Process( () => {
					if ( action === 'track' && this.trackUrl ) {
						location.href = this.trackUrl;
					}
					this.close();
				} );
			}
			return ReportDialog.super.prototype.getActionProcess.call( this, action );
		};

		/* מצב הטופס */

		ReportDialog.prototype.getType = function () {
			const item = this.typeSelect.findSelectedItem();
			return item ? CONFIG.reportTypes.find( ( t ) => t.id === item.getData() ) : null;
		};

		ReportDialog.prototype.getSelectedFiles = function () {
			return this.imagesInput.findSelectedItemsData().map( ( i ) => this.images[ i ].title );
		};

		/** בדיווח על תמונה, כשסומנה לפחות תמונה אחת, הטקסט הוא רשות */
		ReportDialog.prototype.textOptional = function () {
			const type = this.getType();
			return !!( type && type.images && this.getSelectedFiles().length );
		};

		ReportDialog.prototype.isValid = function () {
			const email = this.emailInput.getValue().trim();
			if ( !this.getType() || ( !this.textOptional() && this.textInput.getValue().trim().length < CONFIG.minTextLength ) ) {
				return false;
			}
			if ( this.anonInput.isSelected() && ( this.contact.status !== 'ready' || ( email && !EMAIL_RE.test( email ) ) ) ) {
				return false;
			}
			return !this.captcha.mode || !!this.captcha.getAnswer();
		};

		ReportDialog.prototype.updateState = function () {
			const type = this.getType();
			const anon = this.anonInput.isSelected();
			const showImages = !!( type && type.images );
			this.imagesField.toggle( showImages && this.images.length > 0 );
			this.noImages.toggle( showImages && !this.images.length );
			this.reasonField.toggle( showImages );
			this.textField.setLabel( this.textOptional() ? 'פרטים נוספים (רשות):' : `תוכן הדיווח (לפחות ${ CONFIG.minTextLength } תווים):` );

			this.$anonBox.toggle( anon );
			const email = this.emailInput.getValue().trim();
			this.emailField.setErrors( email && !EMAIL_RE.test( email ) ? [ 'כתובת הדוא"ל אינה תקינה.' ] : [] );
			const status = this.contact.status;
			this.contactMessage.toggle( status === 'loading' || status === 'unavailable' );
			this.contactMessage.setType( status === 'loading' ? 'notice' : 'error' );
			this.contactMessage.setLabel( status === 'loading' ? 'טוען את טופס יצירת הקשר…' : this.contact.message || '' );

			// הסבר: לאן הדיווח הולך ואיך עוקבים אחריו
			const page = type ? $link( type.page ).attr( 'target', '_blank' ) : 'הדיווחים המתאים';
			const loggedOut = mw.config.get( 'wgUserName' ) === null;
			this.notice.setType( !anon && loggedOut ? 'warning' : 'notice' );
			this.notice.setLabel( anon ? $msg(
				'הדיווח יישלח בדוא"ל לצוות המכלול (ראו ', $link( CONFIG.contact.infoPage ).attr( 'target', '_blank' ),
				') ולא יתפרסם באתר, ולכן לא ניתן יהיה לעקוב אחריו בדפי הדיווחים.'
			) : loggedOut ? $msg(
				'הדיווח יפורסם בדף ', page, ', וכתובת ה-IP שלכם תופיע בחתימה ובהיסטוריית הדף. ',
				`כדי שהיא לא תפורסם, סמנו "${ ANON_LABEL }".`
			) : $msg(
				'הדיווח יפורסם בדף ', page, ' ויחתם בשם המשתמש שלכם. לאחר השליחה תקבלו קישור לדיווח, שבו תוכלו לעקוב אחר הטיפול בו.'
			) );

			this.actions.setAbilities( { submit: this.isValid() } );
			if ( this.isOpened() || this.isOpening() ) {
				this.updateSize();
			}
		};

		ReportDialog.prototype.onAnonChange = function () {
			this.captcha.clear();
			this.captcha.setNote( '' );
			this.editCaptcha = this.contactRequest = null;
			this.contact = { status: 'idle' };
			if ( this.anonInput.isSelected() ) {
				this.loadContactForm();
			}
			this.updateState();
		};

		ReportDialog.prototype.loadContactForm = async function () {
			const request = {};
			this.contactRequest = request;
			this.contact = { status: 'loading' };
			this.updateState();
			let contact;
			try {
				contact = await fetchContactForm();
			} catch ( e ) {
				mw.log.error( 'feedback: contact form', e );
				contact = { status: 'unavailable', message: NETWORK_ERROR };
			}
			if ( this.contactRequest !== request ) {
				return;
			}
			this.contact = contact;
			const captcha = contact.captcha;
			if ( !captcha ) {
				this.captcha.clear();
			} else if ( captcha.mode === 'question' ) {
				this.captcha.showQuestion( captcha.text, captcha.image );
			} else {
				this.captcha.showWidget( captcha.vendor, captcha.key );
			}
			this.updateState();
		};

		/* שליחה */

		ReportDialog.prototype.submit = async function () {
			const type = this.getType();
			const pageTitle = getPageTitle();
			const report = {
				type,
				text: this.textInput.getValue().trim(),
				files: type.images ? this.getSelectedFiles() : [],
				reason: type.images ? this.reasonInput.getValue() : '',
				email: this.emailInput.getValue().trim(),
				pageName: pageTitle.getPrefixedText(),
				pageUrl: absoluteUrl( pageTitle.getUrl() ),
				isFile: pageTitle.getNamespaceId() === 6,
			};
			try {
				await ( this.anonInput.isSelected() ? this.sendAnonymously( report ) : this.publish( report ) );
			} catch ( e ) {
				// ה-Process נדחה רק עם OO.ui.Error, כדי ש-OOUI יציג את השגיאה בתוך החלון
				if ( e instanceof OO.ui.Error ) {
					throw e;
				}
				mw.log.error( 'feedback:', e );
				throw new OO.ui.Error( NETWORK_ERROR, { recoverable: true } );
			}
		};

		ReportDialog.prototype.publish = async function ( report ) {
			const page = report.type.page;
			const params = { bot: true, watchlist: 'watch' };
			if ( this.editCaptcha ) {
				// ConfirmEdit קורא את captchaword גם כאסימון של hCaptcha/Turnstile/reCAPTCHA
				if ( this.editCaptcha.id !== undefined ) {
					params.captchaid = this.editCaptcha.id;
				}
				params.captchaword = this.captcha.getAnswer();
			}
			const heading = `[[${ report.isFile ? ':' : '' }${ report.pageName }]]`;
			const data = await api.newSection( page, heading, buildWikitext( report ), params ).catch( ( code, result ) => {
				if ( !result || !( result.error || result.errors ) ) {
					throw new OO.ui.Error( NETWORK_ERROR, { recoverable: true } );
				}
				if ( PERMISSION_ERRORS.includes( code ) ) {
					throw new OO.ui.Error( $msg( api.getErrorMessage( result ),
						` אין באפשרותכם לפרסם את הדיווח בדף הדיווחים. תוכלו לסמן "${ ANON_LABEL }" ולשלוח אותו בדוא"ל לצוות.` ), { recoverable: false } );
				}
				// מסנן ההשחתות (abusefilter-*) ושאר השגיאות: ההודעה מהשרת. אחרי אזהרה אפשר לשלוח שוב
				throw new OO.ui.Error( api.getErrorMessage( result ), { recoverable: code !== 'abusefilter-disallowed' } );
			} );
			const edit = data && data.edit;
			if ( edit && edit.captcha ) {
				const retry = !!this.editCaptcha;
				this.showEditCaptcha( edit.captcha );
				this.captcha.setNote( retry ? 'האימות לא עבר. נסו שוב ולחצו על "שליחה".' :
					'כדי לפרסם את הדיווח נדרש אימות. השלימו אותו ולחצו שוב על "שליחה".', retry ? 'warning' : 'notice' );
				this.updateState();
				return;
			}
			if ( !edit || edit.result !== 'Success' ) {
				throw new OO.ui.Error( 'הדיווח לא נשמר.', { recoverable: true } );
			}
			const trackUrl = `${ mw.util.getUrl( page ) }#${ mw.util.escapeIdForLink( report.pageName ) }`;
			this.showDone( trackUrl, [
				$( '<p>' ).append( $( '<strong>' ).text( SUCCESS ) ),
				$( '<p>' ).append( $msg( 'הדיווח פורסם בדף ', $link( page ), '. תוכלו לעקוב אחר הטיפול בו ולראות את תגובות הצוות ',
					$link( page, 'בפסקת הדיווח', trackUrl ), '.' ) ),
				$( '<p>' ).addClass( 'hm-report-small' ).append( $link( `Special:Diff/${ edit.newrevid }`, 'צפייה בשינוי שנשמר' ) ),
			] );
		};

		ReportDialog.prototype.showEditCaptcha = function ( info ) {
			const vendor = CONFIG.captchaVendors.find( ( v ) => v.type === info.type );
			if ( vendor && info.key ) {
				this.captcha.showWidget( vendor, info.key );
			} else if ( info.question || info.url ) {
				// QuestyCaptcha מחזירה את השאלה כ-HTML; מוצגת כטקסט בלבד
				this.captcha.showQuestion( info.question ? parseHtml( info.question ).body.textContent.trim() : '', info.url ? absoluteUrl( info.url ) : '' );
			} else {
				throw new OO.ui.Error( 'הדיווח לא נשמר: נדרש אימות מסוג שאינו נתמך.', { recoverable: false } );
			}
			this.editCaptcha = { id: info.id };
		};

		ReportDialog.prototype.sendAnonymously = async function ( report ) {
			const contact = this.contact;
			const f = CONFIG.contact.fields;
			const mail = buildEmail( report );
			const params = serializeForm( contact.form );
			params.set( f.subject, mail.subject );
			params.set( f.text, mail.text );
			params.set( f.name, '' );
			params.set( f.email, report.email );
			params.delete( f.ccMe );
			if ( report.email ) {
				params.set( f.ccMe, '1' );
			}
			if ( contact.captcha ) {
				params.set( contact.captcha.mode === 'widget' ? contact.captcha.vendor.field : 'wpCaptchaWord', this.captcha.getAnswer() );
			}

			const res = await fetch( contact.action, { method: 'POST', body: params, credentials: 'same-origin' } );
			const doc = parseHtml( await res.text() );
			const content = doc.querySelector( '#mw-content-text' ) || doc.body;
			// הצלחה רק אם הטופס לא חזר, אין הודעת שגיאה ויש קישור "חזרה" של דף האישור
			if ( res.ok && !findContactForm( doc ) && !content.querySelector( ERROR_SELECTOR ) && doc.getElementById( 'mw-returnto' ) ) {
				this.showDone( null, [
					$( '<p>' ).append( $( '<strong>' ).text( SUCCESS ) ),
					$( '<p>' ).text( 'הדיווח נשלח בדוא"ל לצוות המכלול ולא פורסם באתר, ולכן לא ניתן לעקוב אחריו באתר.' ),
					report.email ? $( '<p>' ).text( `עותק של הדיווח נשלח לכתובת ${ report.email }.` ) : null,
				] );
				return;
			}
			const errors = collectErrors( doc );
			await this.loadContactForm(); // אסימון וקאפצ'ה חדשים לניסיון הבא
			throw new OO.ui.Error( errors || 'שליחת הדיווח האנונימי נכשלה.', { recoverable: !contact.captcha } );
		};

		ReportDialog.prototype.showDone = function ( trackUrl, content ) {
			this.trackUrl = trackUrl;
			this.donePanel.$element.empty().append( content );
			this.formPanel.toggle( false );
			this.donePanel.toggle( true );
			this.actions.setMode( 'done' );
			this.actions.get( { actions: 'track' } ).forEach( ( a ) => a.toggle( !!trackUrl ) );
			this.updateSize();
		};

		return ReportDialog;
	};

	/* ---------- הפעלה ---------- */

	const init = () => {
		const ReportDialog = defineDialog( new mw.Api() );
		let windowManager = null;
		let dialog = null;
		const button = new OO.ui.ButtonWidget( {
			id: 'buttonFeedback',
			icon: 'speechBubble',
			flags: 'progressive',
			label: BUTTON_LABEL,
			invisibleLabel: true,
			title: BUTTON_LABEL,
		} );
		// אירוע click של הווידג'ט מופעל גם ב-Enter וברווח
		button.on( 'click', () => {
			if ( !windowManager ) {
				windowManager = new OO.ui.WindowManager();
				dialog = new ReportDialog();
				$( document.body ).append( windowManager.$element );
				windowManager.addWindows( [ dialog ] );
			}
			if ( !windowManager.getCurrentWindow() ) {
				windowManager.openWindow( dialog );
			}
		} );
		button.$element.appendTo( document.querySelector( '.mw-page-container-inner' ) || document.querySelector( '.mw-body' ) || document.body );
	};

	// רק בצפייה בגרסה הנוכחית של ערך או דף קובץ קיים (לא בגרסה ישנה ולא בהשוואת גרסאות)
	const shouldRun = [ 0, 6 ].includes( mw.config.get( 'wgNamespaceNumber' ) ) &&
		mw.config.get( 'wgAction' ) === 'view' &&
		mw.config.get( 'wgArticleId' ) > 0 &&
		mw.config.get( 'wgRevisionId' ) === mw.config.get( 'wgCurRevisionId' ) &&
		!new URLSearchParams( location.search ).has( 'diff' );

	if ( shouldRun ) {
		$.when( mw.loader.using( DEPENDENCIES ), $.ready ).then( init );
	}
} )();
//</nowiki>
