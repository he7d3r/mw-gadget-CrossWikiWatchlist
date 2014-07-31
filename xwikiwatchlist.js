function makeCORSRequest( wikiapi, params, callback ) {
	params.format = 'json';
	params.origin = 'https://meta.wikimedia.org';
	$.ajax( {
		'url': wikiapi,
		'data': params,
		'xhrFields': {
			'withCredentials': true
		},
		'success': callback,
		'dataType': 'json'
	} );
}

function makeRow( stuff ) {
	return $('<li></li>')
		.append('( ')
		.append(
			$('<a></a>')
				.attr('href', 'https://' + stuff.url + '/?diff=' + stuff.revid)
				.text('diff')
		)
		.append( ' | ')
		.append(
			$('<a></a>')
				.attr('href', 'https://' + stuff.url + '/?action=history&curid=' + stuff.pageid)
				.text('hist')
		)
		.append( ' ) .. ' )
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

function getWatchlist( wiki ) {
	var url, params, cur, realData;
	url = 'https://' + wiki + '/w/api.php';
	params = {
		action: 'query',
		list: 'watchlist',
		wlprop: 'title|ids|sizes|timestamp|user|parsedcomment',
		wltype: 'edit',
		wllimit: '100'
	};
	makeCORSRequest( url, params, function ( data ) {
		realData = [];
		$.each( data.query.watchlist, function( i, val ) {
			val.url = wiki;
			realData.push( val );
		} );
		cur = window.wgWatchlist;
		if ( cur == undefined ) {
			cur = [];
		}
		cur = cur.concat(realData);
		window.wgWatchlist = cur;
		function automagicalSort(a, b) {
			// Reverse sort by time
			return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
		}
		cur.sort(automagicalSort);
		outputList( cur );
	} )
}

function outputList( queryresult ) {
	var ul = $('<ul></ul>');
	$.each( queryresult, function( index, value ) {
		ul.append( makeRow( value ) );
	} );
	var thing = $('#thing');
	thing.text('');
	thing.append( ul );
}

//getWatchlist( 'meta.wikimedia.org' );
