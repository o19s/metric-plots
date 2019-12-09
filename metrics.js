/*
Uses the rating scale of 1-4, where binary conversion is 1&2 are irrelevant and 3&4 are relevant
*/
var min = 1;
var max = 4;

var metrics = [
	'1/r^0.18',
	'1/r^0.5',
	'1/log2(r+1)',
	'1/r',
	'2/2^r'
]

var colors = [
	'black',
	'red',
	'blue',
	'green',
	'purple'
]

//-------------------
// Utils

var scale = 10000; 
function round(x) { 
	return Math.round(x*scale)/scale; 
}

function _gain(grade,maxgrade) {
  return (Math.pow(2,grade)-1) / (Math.pow(2,maxgrade))
}

function _atK(vals,k) {
  k = k||15;
  if (k>vals.length) k=vals.length;
  var docs = vals.slice(0,k);
  return docs;
}

//-------------------
// cascade models

function _log(x, base) {
  var l = Math.log(base);
  return l?(Math.log(x)/l):0;
}

function _log2(x) {
  return Math.log(x) / Math.log(2);
}

function _cascadeLinear(rank) {
  return 1/rank;
}

function _cascadeLog2(rank) {
  return 1/_log2(rank+1);
}

function _cascadeSqrt(rank) {
  return 1/Math.sqrt(rank);
}

function _cascadeExp(rank) {
  return 2/Math.pow(2,rank);
}

function _cascadePow18(rank) {
  return 1/Math.pow(rank,0.18);
}

//-------------------
// Metrics

function ERR(vals,cascade,k) {
  var docs = _atK(vals,k);
  var err = 0.0;
  var trust = 1.0;
  for(var r=1;r<docs.length;r++) {
    var useful = _gain(docs[r-1],max);
    var discount = useful*cascade(r);
    err += trust*discount;
    trust *= (1 - useful);
  }
  return err;
}

function DCG(vals,cascade) {
  var docs = vals;
  var dcg = 0;
  for(var i=0;i<docs.length;i++){
    var d = cascade(i+1);
    var n = Math.pow(2,docs[i])-1;
    dcg+=n*d;
  }
  return dcg;
  
}

function nDCG(vals,cascade,k) {
  var ideal = vals.slice().sort(function(a,b){return b-a});
  var n = DCG(vals,cascade,k);
  var d = DCG(ideal,cascade,k);
  return d?(n/d):0;
}

//-------------------
//Data Generation

var top4 = function(metric) {

	var judgements = [];
	var evaluations = [];

	for(var b=min;b<=max;b++) {

		for(var c=min;c<=max;c++) {

			for(var d=min;d<=max;d++) {

				for(var e=min;e<=max;e++) {

					judgements = [b,c,d,e];
					labels = [e,d,c,b];

					evaluations.push({
						"vals":labels,
						"1/r^0.18":metric(judgements,_cascadePow18), //lenient
						"1/r^0.5":metric(judgements,_cascadeSqrt),
						"1/log2(r+1)":metric(judgements,_cascadeLog2), //default nDCG
						"1/r":metric(judgements,_cascadeLinear), //default ERR
						"2/2^r":metric(judgements,_cascadeExp) //harsh
					});

				}
					
			}
			
		}
		
	}

	/*
	var d = evaluations.slice().sort((a,b)=>(a.errLog2-b.errLog2));
	for(var i=0;i<d.length;i++){
		var r = d[i];
		console.log(r.vals.concat(['']).join('\t')+r.errLog2);
	}
	*/

	return evaluations;

}

//-------------------
// Charting

var plot = function(data,text) {

	if(this.hasOwnProperty('Chart')) {

		var pointilize = function(name,color){
			var points = _.map(data,name).sort((a,b)=>(a-b));
			points = points.map(function(y,x){ return {y:Math.round(y*scale),x:x}; });
			points = points.concat([{y:scale,x:data.length}])
			return {
				label: name,
				data: points,
				backgroundColor: color,
				borderColor: color,
				fill: false,
				lineTension:0
			}
		};

		var datasets = [
			pointilize('1/r^0.18','black'),
			pointilize('1/r^0.5','red'),
			pointilize('1/log2(r+1)','blue'),
			pointilize('1/r','green'),
			pointilize('2/2^r','purple')
		];

		var labels = [];
		for(var i=0;i<=data.length;i++) labels.push(i.toString());

		var can = document.getElementById('MetricsChart');
		var ctx = can.getContext('2d');
		can.style.width = "1600px";
		can.style.height = "800px";
		var myChart = new Chart(ctx, {
		    type: 'line',
		    data: {
		    	labels:labels,
		        datasets:datasets
		    },
			options: {
				responsive: true,
				title: {
					display: true,
					text: text
				},
				tooltips: {
					mode: 'index',
					intersect: true,
				},
				hover: {
					mode: 'nearest',
					intersect: true
				},
				scales: {
					yAxes: [{
						display: true,
						ticks: {
		                    max:scale,
		                    min:0,
		                    callback: function(value, index, values) {
		                        return value/scale;
		                    }
		                },
						scaleLabel: {
							display: true,
							labelString: 'Score'
						}
					}],
					xAxes: [{
						display:true,
						max:256,
						min:1,
						ticks: {
							callback: function(value, index, values) {
								var disp = value;
								if(err_data[value-1] && err_data[value-1].vals) {
									//vals = err_data[value-1].vals.slice();
									//vals.reverse();
									vals = err_data[value-1].vals;
									disp = vals.join('\n');
								}
								return disp;
							}
						},
						scaleLabel: {
							display: true,
							labelString: 'First Four Position Ratings'
						}
					}]					
				}
			}
		});

	}
}

//-------------------
//Tableify

var tableify = function(data){

	var html = "\n";
	for(var i=0;i<data.length;i++) {
		var row = data[i];
		var vals = row.vals;
		var s = "<tr>"
		for(var r=vals.length-1;r>=0;r--) {
			s += "<td class=\"grade_"+vals[r]+"\">"+vals[r]+"</td>";
		}
		for(var m=0;m<metrics.length;m++) {
			score = Math.round(row[metrics[m]]*1000)/1000;
			s += "<td class=\"score_"+colors[m]+"\">"+score+"</td>";
		}
		s+="</tr>\n"
		html+=s;
	}
	document.getElementById("data").innerHTML = html;

}


//-------------------
//Main

window.err_data = top4(ERR);
window.ndcg_data = top4(nDCG);

//var err_sorted = err_data.slice().sort((a,b)=>(a['1/log2(r+1)']-b['1/log2(r+1)']));
//var ndcg_sorted = ndcg_data.slice().sort((a,b)=>(a['1/log2(r+1)']-b['1/log2(r+1)']));

//var err_strings = err_sorted.map((row)=>row.vals.join(','));
//var ndcg_strings = ndcg_sorted.map((row)=>row.vals.join(','));

var metric_name = location.search.toLowerCase().replace(/^[\?]/,'');
console.log(metric_name);

switch (metric_name) {

	case 'err':
		plot(window.err_data,'ERR with varying discount models');
		tableify(window.err_data);
		break;
	default:
		plot(window.ndcg_data,'nDCG with varying discount models')
		tableify(window.ndcg_data)
}


