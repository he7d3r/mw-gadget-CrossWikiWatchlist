/**
 * Cross-Wiki Watchlist
 * @author: Helder (https://github.com/he7d3r)
 * @author: Legoktm (https://github.com/legoktm)
 * @license: CC BY-SA 3.0 <https://creativecommons.org/licenses/by-sa/3.0/>
 */
( function ( mw, $ ) {
	'use strict';

	var $target;

	function makeCORSRequest( wiki, params ) {
		var dfd = $.Deferred(),
			// FIXME: this may be different depending on the wiki configuration
			wikiapi = 'https://' + wiki + '/w/api.php',
			ajaxParams = {
				'url': wikiapi,
				'data': params,
				'dataType': 'json'
			};
		if ( wiki !== location.host ) {
			params.origin = 'https://' + location.host;
			ajaxParams.xhrFields = {
				'withCredentials': true
			};
		}
		$.ajax( ajaxParams )
		.done( function ( data ) {
			dfd.resolve( wiki, data );
		} )
		.fail( dfd.reject );
		params.origin = undefined;
		return dfd.promise();
	}

	// TODO: Bot edits, minor edits
	function makeRow( stuff, isOddLine ) {
		var classes = [],
			projClass = 'proj-' + stuff.url
				.replace( /^www\.(mediawiki|wikidata)\.org$/, '$1' )
				.replace( /^(meta|commons|species|incubator)\.wikimedia\.org$/, '$1' )
				.replace( /^.+?\./, '' )
				.replace( /\.org$/, '' ),
			pad = function ( n ) {
				return n < 10 ? '0' + n : n.toString();
			},
			delta = stuff.newlen - stuff.oldlen,
			deltaClass = delta > 0 ?
				'mw-plusminus-pos' :
				delta === 0 ?
					'mw-plusminus-null' :
					'mw-plusminus-neg',
			sep = '<span class="mw-changeslist-separator">. .</span> ';

		classes.push( projClass );
		if ( stuff.notificationtimestamp !== '' && stuff.timestamp >= new Date( stuff.notificationtimestamp ) ) {
			classes.push( 'mw-changeslist-line-watched' );
		} else {
			classes.push( 'mw-changeslist-line-not-watched' );
		}
		classes.push( isOddLine ? 'mw-line-odd' : 'mw-line-even' );
		return $('<li></li>')
			.addClass( classes.join( ' ' ) )
			// [[MediaWiki:parentheses]]
			.append(
				'(',
				$( '<a></a>' )
					.attr( 'href', '//' + stuff.url + '/?diff=' + stuff.revid )
					.text( 'diff' ),
				// [[MediaWiki:pipe-separator]]
				' | ',
				$( '<a></a>' )
					.attr( 'href', '//' + stuff.url + '/?action=history&curid=' + stuff.pageid )
					.text( 'hist' ),
				// [[MediaWiki:parentheses]]
				')  ',
				sep,
				stuff.minor === '' ? $( '<abbr></abbr>' )
					.addClass( 'minoredit' )
					.attr( 'title', 'This is a minor edit' )
					.text( 'm' ) : '',
				stuff.unpatrolled === '' ? $( '<abbr></abbr>' )
					.addClass( 'unpatrolled' )
					.attr( 'title', 'This edit has not yet been patrolled' )
					.text( '!' ) : '',
				stuff.bot === '' ? $( '<abbr></abbr>' )
					.addClass( 'botedit' )
					.attr( 'title', 'This edit was performed by a bot' )
					.text( 'b' ) : '',
				' ',
				$( '<span></span>' )
					.addClass( 'mw-title' )
					.append(
						$( '<a></a>' )
							.addClass( 'mw-changeslist-title' )
							.attr( 'href', '//' + stuff.url + '/wiki/' + encodeURIComponent( stuff.title ) )
							.text( stuff.title )
					),
				'; ',
				pad( stuff.timestamp.getUTCHours() ),
				':',
				pad( stuff.timestamp.getUTCMinutes() ),
				sep,
				$( '<span></span>' )
					.addClass( deltaClass )
					.append(
						'(',
						delta > 0 ? '+' + delta : delta,
						') '
					),
				sep,
				$('<a></a>')
					.attr( 'href', '//' + stuff.url + '/wiki/User:' + encodeURIComponent( stuff.user ) )
					.text( stuff.user ),
				' (',
				$('<a></a>')
					.attr( 'href', '//' + stuff.url + '/wiki/User_talk:' + encodeURIComponent( stuff.user ) )
					.text( 'talk' ),
				' | ',
				$('<a></a>')
					.attr( 'href', '//' + stuff.url + '/wiki/Special:Contributions/' + encodeURIComponent( stuff.user ) )
					.text( 'contribs' ),
				') ',
				stuff.parsedcomment === '' ? '' : $( '<span></span>' )
					.addClass( 'comment' )
					.html( stuff.parsedcomment.replace( /"\/wiki\//g, '"//' + stuff.url + '/wiki/') )
					.prepend( '(' )
					.append( ')' )
			);
	}

	function outputList( queryresult ) {
		var ul,
			curDay = new Date();
		curDay.setUTCHours(0, 0, 0, 0);
		curDay.setUTCDate( curDay.getUTCDate() + 1 );
		$.each( queryresult, function ( index, value ) {
			if ( value.timestamp < curDay ) {
				if ( ul ) {
					$target.append( ul );
				}
				ul = $( '<ul class="special"></ul>' );
				curDay.setDate( curDay.getDate() - 1 );
				$target.append( $( '<h4></h4>' ).text( [
					value.timestamp.getUTCDate(),
					mw.config.get( 'wgMonthNames' )[value.timestamp.getUTCMonth() + 1],
					value.timestamp.getUTCFullYear()
				].join( ' ' ) ) );
			}
			ul.append( makeRow( value, index % 2 === 1 ) );
		} );
		$target.append( ul );
	}

	function getWatchlist( wikis, extraParams ) {
		var params, cur, realData, i, promises = [];
		if ( typeof wikis === 'string' ) {
			wikis = [ wikis ];
		}
		// TODO:
		// * Check the user preferences for watchlist on target wiki
		// * Maybe allow the user to choose if the preferences in the target wiki
		// has precedence over the local preferences?
		params = {
			action: 'query',
			format: 'json',
			list: 'watchlist',
			wlprop: 'flags|ids|notificationtimestamp|parsedcomment|sizes|timestamp|title|user',
			wltype: 'edit',
			wllimit: '50'
		};
		if (  extraParams.show.length ) {
			params.wlshow = extraParams.show.join( '|' );
		}

		for ( i = 0; i < wikis.length; i++ ) {
			promises.push( makeCORSRequest( wikis[i], params ) );
		}
		$.when.apply( $, promises )
		.done( function () {
			var i, watchlists = Array.prototype.slice.call( arguments );
			function process( key, val ) {
				val.url = watchlists[i][0];
				val.timestamp = new Date( val.timestamp );
				realData.push( val );
			}
			function automagicalSort(a, b) {
				// Reverse sort by time
				return b.timestamp.getTime() - a.timestamp.getTime();
			}
			realData = [];
			for ( i = 0; i < watchlists.length; i++ ) {
				if ( watchlists[i][1].error ) {
					$target.prepend(
						$( '<div class="error"></div>' ).append(
							watchlists[i][0],
							': ',
							watchlists[i][1].error.code,
							': ',
							watchlists[i][1].error.info
						)
					);
				} else {
					$.each( watchlists[i][1].query.watchlist, process );
				}
			}
			cur = window.wgWatchlist || [];
			cur = cur.concat( realData );
			window.wgWatchlist = cur.sort( automagicalSort );
			outputList( cur );
		} )
		.fail( function () {
			mw.log.warn( arguments );
		} );
	}
	function run() {
		var $wlLinks = $( '#mw-watchlist-form' ).find( 'a' ),
			projects = mw.user.options.get(
				'userjs-cw-watchlist',
				[
					mw.config.get( 'wgUserLanguage' ).split('-')[0] + '.wikipedia.org',
					'meta.wikimedia.org'
				]
			),
			params = {};
		if ( typeof projects === 'string' ) {
			projects = JSON.parse( projects );
		}
		$target = $( '.mw-changeslist' ).first();
		if ( !$target.length ) {
			$target = $( '#mw-content-text' );
		}
		$target.empty();
		$wlLinks = $wlLinks.filter( function () {
			return mw.util.getParamValue( 'title', $( this ).attr( 'href' ) ) !== null;
		} ).each( function () {
			var $this = $( this ),
				newTitle = 'Special:Watchlist/cw',
				href = $this.attr( 'href' )
					.replace( /([&?])title=[^&#]*/, '$1title=' + newTitle ),
				param,
				map = {
					hideminor: 'minor',
					hidebots: 'bot',
					hideanons: 'anon',
					hidepatrolled: 'patrolled'
				};
			// TODO: Implement 'hideliu' and 'hidemyself'
			params.show = [];
			for ( param in map ) {
				switch ( mw.util.getParamValue( param ) ) {
					case '1':
						params.show.push( '!' + map[param] );
						break;
					case '0':
						params.show.push( map[param] );
						break;
				}
			}
			$this.attr( 'href', href );
		} );
		mw.util.addCSS( [
			'li.proj-wikibooks { list-style-image: url(//upload.wikimedia.org/wikipedia/commons/e/ec/Wikibooks-favicon.png); }',
			'li.proj-wikinews { list-style-image: url(//upload.wikimedia.org/wikipedia/commons/a/ac/Wikinews-favicon.png); }',
			'li.proj-wikipedia { list-style-image: url(//upload.wikimedia.org/wikipedia/commons/b/b0/Wikipedia-favicon.png); }',
			'li.proj-wikiquote { list-style-image: url(//upload.wikimedia.org/wikipedia/commons/8/8c/Wikiquote-favicon.png); }',
			'li.proj-wikisource { list-style-image: url(//upload.wikimedia.org/wikipedia/commons/3/3e/Wikisource-favicon.png); }',
			'li.proj-wikiversity { list-style-image: url(//upload.wikimedia.org/wikipedia/commons/4/4b/Wikiversity-favicon.png); }',
			'li.proj-wikivoyage { list-style-image: url(//upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Wikivoyage_favicon.svg/16px-Wikivoyage_favicon.svg.png); }',
			'li.proj-wiktionary { list-style-image: url(//upload.wikimedia.org/wikipedia/commons/thumb/8/83/En.wiktionary_favicon.svg/16px-En.wiktionary_favicon.svg.png); }',
			'li.proj-mediawiki { list-style-image: url(//upload.wikimedia.org/wikipedia/commons/thumb/b/bb/MediaWiki-notext.svg/16px-MediaWiki-notext.svg.png); }',
			'li.proj-commons { list-style-image: url(//upload.wikimedia.org/wikipedia/commons/4/47/Wikimedia_Commons_favicon.png); }',
			'li.proj-meta { list-style-image: url(//upload.wikimedia.org/wikipedia/commons/thumb/7/75/Wikimedia_Community_Logo.svg/16px-Wikimedia_Community_Logo.svg.png); }'
		].join( '\n' ) );
		getWatchlist( projects, params );
	}

	if ( mw.config.get( 'wgCanonicalSpecialPageName' ) === 'Watchlist' && /\/cw$/.test( mw.config.get( 'wgTitle' ) ) ) {
		$.when(
			$.ready,
			mw.loader.using( [ 'mediawiki.util', 'user.options' ] )
		)
		.then( run );
	}

}( mediaWiki, jQuery ) );
