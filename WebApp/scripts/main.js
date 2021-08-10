// TODO
// Debut at what position?


function getTransformation(transform) {
  // Create a dummy g for calculation purposes only. This will never
  // be appended to the DOM and will be discarded once this function
  // returns.
  var g = document.createElementNS("http://www.w3.org/2000/svg", "g");

  // Set the transform attribute to the provided string value.
  g.setAttributeNS(null, "transform", transform);

  // consolidate the SVGTransformList containing all transformations
  // to a single SVGTransform of type SVG_TRANSFORM_MATRIX and get
  // its SVGMatrix.
  var matrix = g.transform.baseVal.consolidate().matrix;

  // Below calculations are taken and adapted from the private function
  // transform/decompose.js of D3's module d3-interpolate.
  var {a, b, c, d, e, f} = matrix;   // ES6, if this doesn't work, use below assignment
  // var a=matrix.a, b=matrix.b, c=matrix.c, d=matrix.d, e=matrix.e, f=matrix.f; // ES5
  var scaleX, scaleY, skewX;
  if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
  if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
  if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
  if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
  return {
    translateX: e,
    translateY: f,
    rotate: Math.atan2(b, a) * 180 / Math.PI,
    skewX: Math.atan(skewX) * 180 / Math.PI,
    scaleX: scaleX,
    scaleY: scaleY
  };
}


var app = new Vue({
  delimiters: ['[[', ']]'],
  el: '#main',
  data: {
    fear_item: null,
    modal_fear_item: null,
    graph: null,
    svg: null,
    container: null,
    nameToIdDict: {},
    currentTransform: null,

    // CONFIG
    CIRCLE_RADIUS: 2,
    STROKE_WIDTH: 2,
    MONTH_WIDTH: 45,
    NUM_RANKINGS: 50,
    LABEL_X_POSITION: 500,
  },
  mounted: function() {
    var self = this;

    var allData = [];
    var allDataByMonth = {};
    var allBggIds = [];
    // Set to date format
    for (var key in data) {
      allBggIds.push(data[key][0].bgg_id);
      data[key].map((d, idx) => {
        d.dateStr = d.date;
        d.date = d3.timeParse("%d %b %y")(d.dateStr);
        d.name = d.name.replace("&amp;", "&");
        d.key = key;
        d.next_rank = idx < (data[key].length - 1) ? data[key][idx+1].rank : self.NUM_RANKINGS + 1;
        return d;
      });

      // Set next date (have to do after initial mapping so all dates have been converted from string)
      data[key].map((d, idx) => {
        var nextDateTemp = new Date(d.date.getTime());
        nextDateTemp.setMonth(nextDateTemp.getMonth()+1);
        d.next_date = idx < (data[key].length - 1) ? data[key][idx+1].date : nextDateTemp;
        return d;
      });
      allData.push(...data[key]);
    }

    for (var i = 0; i < allData.length; i++) {
      var entry = allData[i];
      // Assign unique keys to each entry
      entry.id = i;

      if (!(entry.date in allDataByMonth)) {
        allDataByMonth[entry.date] = [];
      }
      allDataByMonth[entry.date].push(entry);
    }


    function monthDiff(d1, d2) {
        var months;
        months = (d2.getFullYear() - d1.getFullYear()) * 12;
        months -= d1.getMonth();
        months += d2.getMonth();
        return months <= 0 ? 0 : months;
    }

    var timeExtent = d3.extent(allData, function(d) { return d.date; });
    var startMonth = timeExtent[0];
    var endMonth = timeExtent[1];
    var numMonths = monthDiff(timeExtent[0], timeExtent[1]) + 1;

    var totalNumRankings = allDataByMonth[startMonth].length;

    var allMonths = [startMonth];
    var currentMonth = new Date(startMonth.getTime());
    for (var i = 0; i < numMonths-1; i++) {
      currentMonth.setMonth(currentMonth.getMonth()+1);
      allMonths.push(currentMonth);
      currentMonth = new Date(currentMonth.getTime());
    }

    // const svg = d3.select("#viz-container").append("svg")
    //   .style("background-color", "white")
    //   .attr("height", "100%")
    //   .attr("width", "100%");

    // set the dimensions and margins of the graph
    var nameBoxWidth
    var margin = {top: 30, right: 30, bottom: 30, left: 30};

    var width = $("#viz-container").width() - margin.left - margin.right;
    var height = $("#viz-container").height() - margin.top - margin.bottom;

    // append the svg object to the body of the page
    var svg = d3.select("#viz-container")
      .append("svg")
        .style("background-color", "#222")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)

    // Retrieve the template data from the HTML (jQuery is used here).
    // var template = $('#tooltip-template').html();

    // Compile the template data into a function
    // var templateScript = Handlebars.compile(template);

    function shuffleArray(array) {
      for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
      }
      return array;
    }

    // We wanna randomize so the colors are more spread out
    var shuffledIds = shuffleArray(allBggIds);
    var colorDict = {};
    for (var i = 0; i < shuffledIds.length; i++) {
      // Get unique color for each board game
      colorDict[shuffledIds[i]] = d3.interpolateSpectral(i / (shuffledIds.length-1));
    }

    /* Initialize tooltip */
    const tip = d3.tip().attr('class', 'd3-tip').html(function(event, d) {
      return d.name;
        // console.log(d);
        // return templateScript({
        //     fear_item: d.fields,
        //     fear_text_present: d.fields.fear_text.length > 1,
        //     fear_text: d.fields.fear_text.split('\n'),
        //     fear_colors_text_present: d.fields.fear_colors_text.length > 1,
        //     fear_colors_text: d.fields.fear_colors_text.split('\n'),
        // });
    });

    // tip.direction(function(d) {
    //     var transformStr = container.attr("transform");
    //     var translate = [0,0];
    //     if (transformStr) {
    //         translate = transformStr.substring(transformStr.indexOf("(")+1, transformStr.indexOf(")")).split(",");
    //         translate = translate.map(function(d) {
    //             return parseInt(d);
    //         })
    //     }

    //     var y = d.y + translate[1];
    //     console.log(d.y, translate[1]);
    //     console.log(y)
    //     if (y < 250) {
    //         return 's';
    //     }
    //     else {
    //         return 'n';
    //     }
    // })

    var viewport = svg.append("svg")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("height", height);
      // .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
    var xAxisViewport = svg.append("svg")
      .attr("x", margin.left)
      .attr("y", margin.top);

    container = viewport.append("g")
    /* Invoke the tip in the context of your visualization */
    svg.call(tip);

    // Style axes
    var axisColor = "white";
    var xAxisWidth = numMonths * self.MONTH_WIDTH;

    // Add Y axis
    self.yScale = d3.scaleLinear()
      // .domain( d3.extent(data, function(d) { return + d.rank; }) )
      .domain([self.NUM_RANKINGS,1])
      .range([ height, 0 ]);
    var yAxis = d3.axisLeft(self.yScale).tickSizeOuter(0).ticks(self.NUM_RANKINGS);
    var gY = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      .call(yAxis)
      .style("color", axisColor);

    // Add X axis --> it is a date format
    self.xScale = d3.scaleTime()
      .domain(timeExtent)
      .range([ 0, width ]);
    self.xScaleTransformed = self.xScale;

    var xAxisHeight = (height);
    // var xAxis = d3.axisBottom(self.xScale).ticks(numMonths).tickSizeOuter(0);
    var xAxis = (g, x) => g
      .attr("transform", "translate(0," + xAxisHeight + ")")
      .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0))
      .style("color", axisColor);

    // var gX = xAxisViewport.append("g")
    //   .attr("transform", "translate(0," + xAxisHeight + ")")
    //   .call(xAxis)
    //   .style("color", axisColor);

    var gX = xAxisViewport.append("g").call(xAxis, self.xScale);

    var graph = container.append("svg").append("g");
    var namesGroup = svg.append("g");

    var currentStartTime = allMonths[0];
    var NAME_DISPLAY_BASE_INDEX = 0; // Where to show the tip

    function redrawNameBoxes() {

      var currentStartTime = self.xScaleTransformed.invert(self.LABEL_X_POSITION);

      // Set to start of current month
      var nameDisplayMonth = new Date(currentStartTime.getTime());
      nameDisplayMonth.setDate(1);
      nameDisplayMonth.setHours(0,0,0,0);

      var currentX = self.xScaleTransformed(currentStartTime);

      // console.log(nameDisplayMonth == allMonths[0]);
      var gamesThisMonth = allDataByMonth[nameDisplayMonth];
      var nameBoxes = namesGroup.selectAll("g")
        .data(gamesThisMonth, function(d) {
          return d.bgg_id;
        });
        // .join("g");

      // UPDATE
      nameBoxes
        .attr("transform", function(d) {
          var x = margin.left + self.LABEL_X_POSITION;
          var initialX = self.xScaleTransformed(d.date);
          var initialY = self.yScale(d.rank);
          var nextX = self.xScaleTransformed(d.next_date);
          var nextY = self.yScale(d.next_rank);

          // Calculate Y via linear interpolation
          var currentY = (nextY - initialY) * (currentX - initialX) / (nextX - initialX) + initialY;
          var y = currentY + margin.top;

          return "translate(" + x + ", " + y + ")";
        })

      // var path = d3.select("#graph-path-" + gamesThisMonth[0].bgg_id).node();
      // var path = d3.select("#graph-path-3076").node();
      // var yVal = path.getPointAtLength(currentXDelta);
      // console.log(yVal, currentXDelta);

      var nameBoxHeight = 20;
      var nameBoxMarginLeft = 20;
      var nameBoxWidth = margin.left - nameBoxMarginLeft;
      // nameBoxes.append("rect")
      //   // .attr('x', function(d) { return self.xScaleTransformed(d.date) - nameBoxWidth/2; })
      //   .attr('x', function(d) { return margin.left - nameBoxWidth - nameBoxMarginLeft; })
      //   .attr('y', function(d) { return self.yScale(d.rank) - nameBoxHeight/2 + margin.top; })
      //   .attr('width', nameBoxWidth)
      //   .attr('height', nameBoxHeight)
      //   .attr('stroke', 'black')
      //   .attr('fill', '#FFFFFF');

      var nameBoxesEnter = nameBoxes.enter()
        .append("g")
        .attr("transform", function(d) {
          var x = margin.left + self.LABEL_X_POSITION;
          var initialX = self.xScaleTransformed(d.date);
          var initialY = self.yScale(d.rank);
          var nextX = self.xScaleTransformed(d.next_date);
          var nextY = self.yScale(d.next_rank);

          // Calculate Y via linear interpolation
          var currentY = (nextY - initialY) * (currentX - initialX) / (nextX - initialX) + initialY;
          var y = currentY + margin.top;

          return "translate(" + x + ", " + y + ")";
        });

      nameBoxesEnter.append("text")
          .attr("class", "graph-names")
          .style("dominant-baseline", "central")
          .style("text-anchor", "end")
          .style("cursor", "default")
          .style("fill", function(d) { return colorDict[d.bgg_id];})
          .text(function(d) {
            return d.name;
          })
          .on('mouseover', function(event, d) {
            self.focusSingleBoardgame(d.bgg_id);
          })
          .on('mouseout', function(event, d) {
            self.showAllBoardgames();
          });

      nameBoxesEnter.append("text")
          .attr("class", "graph-names")
          .style("dominant-baseline", "central")
          .style("text-anchor", "end")
          .style("cursor", "default")
          .style("fill", function(d) { return colorDict[d.bgg_id];})
          .text(function(d) {
            return d.name;
          })
          .on('mouseover', function(event, d) {
            self.focusSingleBoardgame(d.bgg_id);
          })
          .on('mouseout', function(event, d) {
            self.showAllBoardgames();
          });

      nameBoxes.exit().remove();
    }

    var scrollXDelta = 0;
    var count = 42;
    var VISIBLE_BUFFER = 15;
    var prevStartDate = allMonths[0];
    var prevEndDate = allMonths[0];

    var zoom = d3.zoom()
      .translateExtent([[0, -Infinity], [width, Infinity]])
      .scaleExtent([1,10])
      .extent([[0, 0], [width, height]])
      .on('zoom', function(event) {
        self.xScaleTransformed = event.transform.rescaleX(self.xScale);
        gX.call(xAxis, self.xScaleTransformed);

        // var displayStartDate = self.xScaleTransformed.invert(0);
        // var displayEndDate = self.xScaleTransformed.invert(width+50);

        // console.log(displayStartDate, displayEndDate);
        // self.currentVisibleMonths = [displayStartDate, displayEndDate];

        // // Only redraw if we zoom out of the current bounding window
        // if (prevStartDate > displayStartDate || prevEndDate < displayEndDate) {
        //   displayStartDate.setMonth(displayStartDate.getMonth() - VISIBLE_BUFFER);
        //   displayEndDate.setMonth(displayEndDate.getMonth() + VISIBLE_BUFFER);

        //   self.currentVisibleMonths = [displayStartDate, displayEndDate];
        //   self.redraw(data);
        //   prevStartDate = displayStartDate;
        //   prevEndDate = displayEndDate;
        // }

        self.redraw(data);

        redrawNameBoxes();
        // self.graph.attr("transform", "scale(" + event.transform.k + " 1) translate(" + event.transform.x + ",0)");

        return;

        if (event.sourceEvent.type == "wheel") {
          // var oneMonthXVal = self.xScaleTransformed(allMonths[currentStartIdx + 1]) - self.xScaleTransformed(allMonths[currentStartIdx]); // Get num of pixels of one month
          // var t = getTransformation(xAxis.attr("transform")),
          //   x = t.translateX,
          //   y = t.translateY;

          // var xDelta = event.sourceEvent.wheelDeltaY;

          // var newX = x;
          // if (xDelta > 0 && currentStartIdx < numMonths - 2 - NAME_DISPLAY_BASE_INDEX) {
          //   currentStartIdx += 1;
          //   newX = x - oneMonthXVal;
          //   redrawNameBoxes(currentStartIdx);
          // }
          // else if (xDelta < 0 && currentStartIdx > 0) {
          //   currentStartIdx -= 1;
          //   newX = x + oneMonthXVal;
          //   redrawNameBoxes(currentStartIdx);
          // }

          // var currentMaxVisibleWidth = $("#viz-container").width();

          // // Note that this is an approximation so we just add 5 to it
          // var maxMonthsVisible = monthDiff(self.xScaleTransformed.invert(0), self.xScaleTransformed.invert(currentMaxVisibleWidth));

          // var minVisibleIndex = Math.max(0, currentStartIdx-VISIBLE_BUFFER);
          // var maxVisibleIndex = Math.min(numMonths-1, currentStartIdx + maxMonthsVisible + VISIBLE_BUFFER);
          // self.currentVisibleMonths = [allMonths[minVisibleIndex], allMonths[maxVisibleIndex]]

          // xAxis.attr("transform", "translate(" + newX + "," + xAxisHeight + ")");
          // graph.attr("transform", "translate(" + newX + ",0)");

          // self.redraw(data);
          const transform = event.transform;
          console.log(event.transform);

          // rescale the x linear scale so that we can draw the top axis
          self.xScaleTransformed = transform.rescaleX(self.xScale);
          self.currentTransform = transform;
          xAxis.scale(self.xScaleTransformed);
          gX.call(xAxis);

          self.redraw(data);
          // // draw the lines, circles, bars in their new positions
          // lines.attr('cx', function(d) { return transform.applyX(self.xScaleTransformed(d)); });
          // circles.attr('cx', function(d) { return transform.applyX(self.xScaleTransformed(d)); });
          // bars.attr('cx', function(d) { return transform.applyX(self.xScaleTransformed(d)); });
        }
        else {
          var newX = event.transform.x;
          // convert new X to multiple of one month distance
          // newX = Math.floor(newX / oneMonthXVal) * oneMonthXVal;

          if (self.currentTransform != null) {
            newX = transform.rescaleX(newX);
          }


          var currentMaxVisibleWidth = $("#viz-container").width();
          var displayStartDate = self.xScaleTransformed.invert(-newX);
          var displayEndDate = self.xScaleTransformed.invert(-newX + currentMaxVisibleWidth);

          // Only redraw if we zoom out of the current bounding window
          if (prevStartDate > displayStartDate || prevEndDate < displayEndDate) {
            displayStartDate.setMonth(displayStartDate.getMonth() - VISIBLE_BUFFER);
            displayEndDate.setMonth(displayEndDate.getMonth() + VISIBLE_BUFFER);

            self.currentVisibleMonths = [displayStartDate, displayEndDate];
            self.redraw(data);
            prevStartDate = displayStartDate;
            prevEndDate = displayEndDate;
            console.log("REDRAW!");
          }

          gX.attr("transform", "translate(" + newX + "," + xAxisHeight + ")");
          graph.attr("transform", "translate(" + newX + ",0)");
        }

      });
    svg.call(zoom)
    .transition()
      .duration(1000)
      .call(zoom.scaleTo, 4, [self.xScale(allMonths[0]), 0]);
    // // Add the area
    // container.append("path")
    //   .datum(data)
    //   .attr("fill", "#69b3a2")
    //   .attr("fill-opacity", .3)
    //   .attr("stroke", "none")
    //   .attr("d", d3.area()
    //     .x(function(d) { return self.xScaleTransformed(d.date) })
    //     .y0( height )
    //     .y1(function(d) { return self.yScale(d.value) })
    //     );

    var currentMaxVisibleWidth = $("#viz-container").width();

    // Note that this is an approximation so we just add 5 to it
    var maxMonthsVisible = monthDiff(self.xScaleTransformed.invert(0), self.xScaleTransformed.invert(currentMaxVisibleWidth));

    var maxVisibleIndex = Math.min(numMonths-1, maxMonthsVisible + VISIBLE_BUFFER);
    self.currentVisibleMonths = [allMonths[0], allMonths[maxVisibleIndex]]

    self.graph = graph;
    self.container = container;
    self.colorDict = colorDict;

    self.redraw(data);
    redrawNameBoxes();
  },
  methods: {
    focusSingleBoardgame: function(bgg_id) {
      var self = this;

      d3.selectAll(".graph-path").attr('stroke-opacity', "0.1");
      d3.selectAll(".graph-circle").attr('opacity', "0.1");
      d3.selectAll(".graph-names").attr('opacity', "0.1");
      // d3.selectAll(".graph-path").attr('stroke-opacity', "0.1");
      // d3.selectAll(".graph-circle").attr('opacity', "0.1");
      // d3.selectAll(".graph-names").attr('opacity', "0.1");

      d3.selectAll(".graph-circle").filter(function(d2, i) {
          return d2.bgg_id == bgg_id;
        }).attr('opacity', "1");
      d3.selectAll(".graph-names").filter(function(d2, i) {
          return d2.bgg_id == bgg_id;
        }).attr('opacity', "1");
      // d3.select(this).attr('stroke', '#ffffff');

      d3.select("#graph-path-" + bgg_id).attr('stroke-opacity', 1.0);
      d3.select("#graph-path-" + bgg_id).attr('stroke-width', self.STROKE_WIDTH + 1);
    },
    showAllBoardgames: function() {
      var self = this;

      d3.selectAll(".graph-path").attr('stroke-opacity', "1");
      d3.selectAll(".graph-circle").attr('opacity', "1");
      d3.selectAll(".graph-names").attr('opacity', "1");
      // d3.selectAll(".graph-path").attr('stroke-opacity', "1");
      // d3.selectAll(".graph-circle").attr('opacity', "1");
      d3.selectAll(".graph-names").attr('opacity', "1");
      d3.selectAll(".graph-path").attr('stroke-width', self.STROKE_WIDTH);
    },
    redraw: function(data) {
      var self = this;

      var graph = self.graph;
      var container = self.container;
      var colorDict = self.colorDict;

      var numNodesDisplayed = 0;
      var filteredData = [];
      var allFilteredData = [];
      for (var key in data) {

        var bgData = data[key];
        var bgg_id = bgData[0].bgg_id;

        // Only show visible months so we don't lag the app
        // bgData = bgData.filter(bgEntry => bgEntry.date >= self.currentVisibleMonths[0] && bgEntry.date <= self.currentVisibleMonths[1])

        filteredData.push({name:key, bgg_id:bgg_id, data:bgData});
        allFilteredData.push(...bgData);

        numNodesDisplayed += bgData.length;
      }

      // // Add the circles
      // var circles = graph.selectAll(".graph-circle")
      //   .data(allFilteredData, function(d) {
      //     return d.id;
      //   })
      //   // .join("circle")
      // // UPDATE
      // circles
      //     .attr("cx", function(d) { return self.xScaleTransformed(d.date) })

      // // ENTER
      // circles.enter()
      //   .append("circle")
      //     .attr("class", "graph-circle")
      //     .attr("fill", function(d) {
      //       return colorDict[d.bgg_id];
      //     })
      //     .attr("stroke", function(d) {
      //       return colorDict[d.bgg_id];
      //     })
      //     .attr("cx", function(d) { return self.xScaleTransformed(d.date) })
      //     .attr("cy", function(d) { return self.yScale(d.rank) })
      //     .attr("r", self.CIRCLE_RADIUS);

      // circles.exit().remove();

      // Add the lines
      var paths = graph.selectAll('path').data(filteredData);

      // UPDATE
      paths.attr("d", function(d) {
          var line = d3.line()
            .x(function(d) { return self.xScaleTransformed(d.date) })
            .y(function(d) { return self.yScale(d.rank) });
          return line(d.data);
        }
      );

      // ENTER
      paths.enter().append("svg:path")
        .attr("class", "graph-path")
        .attr("id", d => "graph-path-" + d.bgg_id)
        .attr("fill", "none")
        .attr("stroke", function(d) {
          return colorDict[d.bgg_id];
        })
        .attr("stroke-width", self.STROKE_WIDTH)
        .attr("d", function(d) {
            var line = d3.line()
              .x(function(d) { return self.xScaleTransformed(d.date) })
              .y(function(d) { return self.yScale(d.rank) });
            return line(d.data);
          }
        );
        // .on('mouseover', function(event, d) {
        //   self.focusSingleBoardgame(d.bgg_id);
        // })
        // .on('mouseout', function(event, d) {
        //   self.showAllBoardgames();
        // });

      // EXIT
      paths.exit().remove();

      // console.log("NUM NODES: " + numNodesDisplayed);
      // console.log("NUM NODES (ACTUAL): " + $(".graph-circle").length);
      // console.log("NUM NODES (ACTUAL): " + $("path").length);
    }
  }

});
