var request = require('request');
var cheerio = require('cheerio');
var _ 		= require('lodash');
var fs 		= require('fs');

const NUMBER_OF_NEWS_PAGES = 2;
const PAGES_CHUNK_SIZE = 10;
const NEWS_SITES = {
    
	newsbitcoin: {
		site : 'newsbitcoin',
		newsListUrl: function(pageIndex) { return 'https://news.bitcoin.com/page/'+pageIndex+'/?s' },
		newsListSelector: '.item-details',
		titleSelector: '.entry-title.td-module-title',
		timestampSelector: '.td-module-date',
		textSelector: '.td-post-content'
	},
	coindesk : {
		site : 'coindesk',
		newsListUrl: function(pageIndex) { return 'https://www.coindesk.com/page/'+pageIndex+'/?s' },
		newsListSelector: '.post-info',
		titleSelector: 'h3',
		timestampSelector: 'time',
		textSelector: '.article-post-container'
	}
};


var newsProcessed = 0;
var newsTotal = 0;

var newsList = [];
var currentNewsSite = {};

async function getNews() {
	console.log('Collecting news...');

	for (site in NEWS_SITES) {
		if (NEWS_SITES.hasOwnProperty(site)){
			currentNewsSite = NEWS_SITES[site];		
			await processNewsSite(currentNewsSite);
			writeNewsToFile();				
		}		
	}
}

async function processNewsSite() {
	console.log("Processing " + currentNewsSite.site + '...');
	var arr = [];
	for (var i = 1; i < NUMBER_OF_NEWS_PAGES + 1; i++) {
		arr.push(i)
	}	
	var pagesArray = _.chunk(arr, PAGES_CHUNK_SIZE);
	for (let pages of pagesArray) {		
		console.log("Pages " + pages);
		await Promise.all(pages.map(pageIdx => requestNewsMetadata(pageIdx)));
	}
	return;
}

function requestNewsMetadata(pageIndex) {
	return new Promise(function(resolve, reject) {

		request(currentNewsSite.newsListUrl(pageIndex), {timeout: 20000}, function(err, resp, html) {	
			if (!err){
				const $ = cheerio.load(html);
				var listSelector = $(currentNewsSite.newsListSelector);
				var textPromises = [];

				listSelector.each( function(index, element) {		
					var titleSelector = $(element).find(currentNewsSite.titleSelector);
					var titleUntreated = titleSelector.text();
					var	title = titleUntreated.replace(/\\n/g,'');
					var url = titleSelector.find('a').attr('href');								
					var timestamp = $(element).find(currentNewsSite.timestampSelector).attr('datetime');
					newsTotal++;	
					
					textPromises.push(getNewsTextFromUrl(url)
						.then( function(txt) {								
							newsList.push({title, url, txt, timestamp});										
						})	
					);
				});	
				 resolve(Promise.all(textPromises));
			}else {
			  console.log(err);
			  reject(err);
			}
		});		
	});			
};

function getNewsTextFromUrl(url) {
	return new Promise(function(resolve, reject) {

		request(url, {timeout: 20000}, function(err, resp, html) {		
			newsProcessed++;
			if (!err){
				var s = '';
				const $ = cheerio.load(html);
				$(currentNewsSite.textSelector).each(function(index, element){								
					try {
						s = $(element).find('p').text();					
					} catch(e) {
						return true;
					}	
				});			
					txt = s.replace(/<.+?\/>/g,'');
					txt = txt.replace(/\\/g,'');
					txt = txt.replace(/\\n.*/g,'');
					console.log('Retrieving news ' + newsProcessed + '/' + newsTotal);

					resolve(txt);
			}else {
				reject(err);
			}
		});		
		
	});	
}

function writeNewsToFile() {
	console.log(`Finished. Saving ${newsList.length} news...`);
	fs.writeFile(`./${currentNewsSite.site}News.json`, JSON.stringify(newsList, null, 4), (err) => {
	if (err) {
		console.error(err);
		return;
	};
		console.log(`File ${currentNewsSite.site}News.json created`);
	})
	
}

// TODO: 
//	Error handling
//	TSV Export
//	Date filter (update news instead of getting all)

//	Starts here 
getNews();


