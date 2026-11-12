// סביבת MediaWiki מדומה לבדיקות: mw.config, mw.Title, mw.util, mw.Api ועוד, ככל שהגאדג'ט צריך
window.TEST = { calls: [], newSectionResponses: [] };
( function () {
	const NS = { 'קובץ': 6, File: 6, Special: -1, 'מיוחד': -1, 'המכלול': 4, 'קטגוריה': 14 };
	const NSNAME = { 6: 'קובץ', '-1': 'מיוחד', 4: 'המכלול', 14: 'קטגוריה' };
	const wikiUrlencode = ( s ) => encodeURIComponent( s.replace( / /g, '_' ) ).replace( /%3A/g, ':' ).replace( /%2F/g, '/' );

	function Title( ns, main ) {
		this.ns = ns;
		this.main = main;
	}
	Title.prototype.getNamespaceId = function () { return this.ns; };
	Title.prototype.getMainText = function () { return this.main; };
	Title.prototype.getPrefixedText = function () { return ( this.ns ? NSNAME[ this.ns ] + ':' : '' ) + this.main; };
	Title.prototype.getUrl = function () { return mw.util.getUrl( this.getPrefixedText() ); };
	Title.newFromText = function ( t, defNs ) {
		t = String( t ).replace( /_/g, ' ' ).trim();
		const m = t.match( /^([^:]+):(.+)$/ );
		if ( m && NS[ m[ 1 ] ] !== undefined ) {
			return new Title( NS[ m[ 1 ] ], m[ 2 ][ 0 ].toUpperCase() + m[ 2 ].slice( 1 ) );
		}
		return new Title( defNs || 0, t );
	};
	// כמו ב-MediaWiki: מזהה את שם הקובץ לפי מבנה הנתיב /x/xy/Name (גם בתמונות ממוזערות)
	Title.newFromImg = function ( img ) {
		const src = ( img.jquery ? img[ 0 ] : img ).getAttribute( 'src' );
		const m = src.match( /\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/ );
		return m ? new Title( 6, decodeURIComponent( m[ 1 ] ).replace( /_/g, ' ' ) ) : null;
	};

	window.mw = {
		config: { values: window.MWCONFIG, get( k ) { return this.values[ k ]; } },
		loader: {
			using() { return $.Deferred().resolve().promise(); },
			getScript( url ) { return $.ajax( { url, dataType: 'script', cache: true } ); },
		},
		log: { error( ...a ) { console.error( 'mw.log.error', ...a.map( String ) ); } },
		Title,
		util: {
			getUrl( t, q ) { return '/wiki/' + wikiUrlencode( t ) + ( q ? '?' + new URLSearchParams( q ) : '' ); },
			escapeIdForLink( s ) { return s.replace( / /g, '_' ); },
		},
		Api: function () {},
	};
	// כל קריאה ל-newSection צורכת תשובה מהתור TEST.newSectionResponses; ברירת המחדל היא הצלחה
	mw.Api.prototype.newSection = function ( page, heading, text, extra ) {
		TEST.calls.push( [ 'newSection', page, heading, text, extra ] );
		const r = TEST.newSectionResponses.shift() || { resolve: { edit: { result: 'Success', newrevid: 555 } } };
		const d = $.Deferred();
		setTimeout( () => ( r.reject ? d.reject( ...r.reject ) : d.resolve( r.resolve ) ), 50 );
		return d.promise();
	};
	mw.Api.prototype.getErrorMessage = function ( r ) { return $( '<span>' ).text( r.error.info ); };
}() );
