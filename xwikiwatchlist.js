function makeCORSRequest( wiki, params ) {
	var dfd = $.Deferred(),
		// FIXME: this may be different depending on the wiki configuration
		wikiapi = 'https://' + wiki + '/w/api.php';
	params.format = 'json';
	// TODO: allow usage on other wikis?
	params.origin = 'https://meta.wikimedia.org';
	$.ajax( {
		'url': wikiapi,
		'data': params,
		'xhrFields': {
			'withCredentials': true
		},
		'dataType': 'json'
	} )
	.done( function( data ) {
		dfd.resolve( wiki, data );
	} )
	.fail( dfd.reject );
	return dfd.promise();
}

function makeRow( stuff, isOddLine ) {
	var classes = [ 'mw-changeslist-line-watched' ],
		projClass = 'proj-' + stuff.url
			.replace( /^www\.(mediawiki|wikidata)\.org$/, '$1' )
			.replace( /^(meta|commons|species|incubator)\.wikimedia\.org$/, '$1' )
			.replace( /^.+?\./, '' )
			.replace( /\.org$/, '' );
		
	classes.push( projClass );
	classes.push( isOddLine ? 'mw-line-odd' : 'mw-line-even' );
	return $('<li></li>')
		.addClass( classes.join( ' ' ) )
		// [[MediaWiki:parentheses]]
		.append('(')
		.append(
			$('<a></a>')
				.attr('href', 'https://' + stuff.url + '/?diff=' + stuff.revid)
				.text('diff')
		)
		// [[MediaWiki:pipe-separator]]
		.append( ' | ')
		.append(
			$('<a></a>')
				.attr('href', 'https://' + stuff.url + '/?action=history&curid=' + stuff.pageid)
				.text('hist')
		)
		// [[MediaWiki:parentheses]]
		.append( ')  ' )
		.append( '<span class="mw-changeslist-separator">. .</span> ' )
		.append(
			$('<a></a>')
				.attr('href', 'https://' + stuff.url + '/wiki/' + encodeURIComponent( stuff.title ) )
				.text( stuff.title )
		)
		// FIXME: make timestamp pretty
		// FIXME: add diff size
		.append( '; ' + stuff.timestamp + ' .. ')
		.append(
			$('<a></a>')
				.attr('href', 'https://' + stuff.url + '/wiki/User:' + encodeURIComponent( stuff.user ) )
				.text( stuff.user )
		)
		.append( ' ' )
		.append(
			$('<span></span>')
				.addClass('editsummary')
				.html( stuff.parsedcomment.replace(new RegExp('"/wiki/', 'g'), '"//' + stuff.url + '/wiki/') )
		);
}

function outputList( queryresult ) {
	var ul = $('<ul class="special"></ul>');
	$.each( queryresult, function( index, value ) {
		// TODO: Add <h4>'s above the latest edit of each day
		ul.append( makeRow( value, index % 2 === 1 ) );
	} );
	var thing = $('#mw-content-text');//$('#thing');
	thing.text('');
	thing.append( ul );
}

function getWatchlist() {
	var params, cur, realData,
		wikis = Array.prototype.slice.call( arguments );
	// TODO:
	// * Check the user preferences for watchlist on target wiki
	// * Maybe allow the user to choose if the preferences in the target wiki
	// has precedence over the local preferences?
	params = {
		action: 'query',
		list: 'watchlist',
		wlprop: 'title|ids|sizes|timestamp|user|parsedcomment',
		wltype: 'edit',
		wllimit: '50'
	};
	
	var i, promises = [];
	for ( i = 0; i < wikis.length; i++ ) {
		promises.push( makeCORSRequest( wikis[i], params ) );
	}
	$.when.apply( $, promises )
	.done( function () {
		var i, watchlists = Array.prototype.slice.call( arguments );
		function automagicalSort(a, b) {
			// Reverse sort by time
			return b.timestamp.getTime() - a.timestamp.getTime();
		}
		realData = [];
		for( i = 0; i < watchlists.length; i++ ){
			$.each( watchlists[i][1].query.watchlist, function( key, val ) {
				val.url = watchlists[i][0];
				val.timestamp = new Date( val.timestamp );
				realData.push( val );
			} );
		}
		cur = window.wgWatchlist || [];
		cur = cur.concat( realData );
		window.wgWatchlist = cur.sort( automagicalSort );
		outputList( cur );
	} )
	.fail( function(){
		mw.log.warn( arguments );
	} );
}

if( mw.config.get( 'wgPageName' ) === 'Special:Watchlist/global' ){
	$.when(
		$.ready,
	mw.loader.using( [ 'mediawiki.util' ] ) )
	.then( function(){
		mw.util.addCSS( [
			'.proj-wikibooks { list-style-image: url(//bits.wikimedia.org/favicon/wikibooks.ico); }',
			'.proj-wikinews { list-style-image: url(//bits.wikimedia.org/favicon/wikinews.ico); }',
			'.proj-wikipedia { list-style-image: url(//bits.wikimedia.org/favicon/wikipedia.ico); }',
			'.proj-wikiquote { list-style-image: url(//bits.wikimedia.org/favicon/wikiquote.ico); }',
			'.proj-wikisource { list-style-image: url(//bits.wikimedia.org/favicon/wikisource.ico); }',
			'.proj-wikiversity { list-style-image: url(//bits.wikimedia.org/favicon/wikiversity.ico); }',
			'.proj-wikivoyage { list-style-image: url(//bits.wikimedia.org/favicon/wikivoyage.ico); }',
			'.proj-wiktionary { list-style-image: url(//bits.wikimedia.org/favicon/wiktionary/en.ico); }',
			'.proj-mediawiki { list-style-image: url(//bits.wikimedia.org/favicon/mediawiki.ico); }',
			'.proj-commons { list-style-image: url(//bits.wikimedia.org/favicon/commons.ico); }'
		].join( '\n' ) );
		getWatchlist(
			'en.wikipedia.org',
			'en.wiktionary.org',
			'pt.wikipedia.org',
			'pt.wikibooks.org',
			// 'meta.wikimedia.org', // Forbidden (why?)
			'www.mediawiki.org',
			'commons.wikimedia.org',
			'br.wikimedia.org'
		);
	} );
}
