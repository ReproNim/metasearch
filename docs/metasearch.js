var parcoords;
var dataset;
var dataView;
var sortcol;
var sortdir;

// load csv file and create the chart
d3.csv('https://services.scicrunch.io/repronim/lake/cohort/metasearch.csv', function (data) {

    // slickgrid needs each data element to have an id
    data.forEach(function (d, i) {
        d.id = d.id || i;
    });
    dataset = data;
    // project_title,ID,age,sex,diagnosis,field_strength2,manufacturer,image_type,contrast_type,task,location
    dimensionObj = {
        // "MRI": {"index": 0},
        "project_title": {"index": 1},
        //"site_id": {"index": 2},
        "sex": {"index": 3},
        "diagnosis": {"index": 4},
        "age": {"index": 5},
        "field_strength2": {"index": 6},
        "manufacturer": {"index": 7},
        "image_type": {"index": 8},
        "contrast_type": {"index": 9},
        "task": {"index": 11},
        //"session_count": {"index": 10}
    };

    parcoords = d3.parcoords()("#filter")
    .data(data)
    .alpha(0.1)
    .mode("queue") // progressive rendering
    .rate(30)
    .margin({ top: 30, left: 0, bottom: 20, right: 0 })
    .hideAxis(["ID", 'location',])
    .dimensions(dimensionObj)
    .render()
    .reorderable()
    .brushMode("1D-axes")
    .autoscale();

    change_color("age");

    parcoords.svg
    .selectAll(".dimension")
    .on("click", change_color);

    parcoords.svg.selectAll('text').each(function (d, i) { var elt = d3.select(this); if (elt.attr("class") == "label") { this.setAttribute("y", -10) }; } );

    // setting up grid
    var column_keys = d3.keys(data[0]);
    column_keys = ['project_title', 'ID', 'diagnosis', 'sex', 'age', 'location'];
    var linkformatter = function(row, cell, value, columnDef, dataContext) {
        if (value == ''){
            return '';
        }else{
            var docno = value ? value : "";
            return '<a target="_blank" href="https://brainbox.pasteur.fr/mri/?url=' + docno + '">BrainBox</a>';
        }
    };
    var columns = column_keys.map(function (key, i) {
        var sorter = sorterStringCompare;
        if (key == 'age'){
            sorter = sorterNumeric;
        }

        if (key == 'location'){
            return {
                id: key,
                name: key,
                field: key,
                sortable: true,
                formatter: linkformatter,
                sorter: sorter
            }
        } else{
            return {
                id: key,
                name: key,
                field: key,
                sortable: true,
                sorter: sorter
            }
        }
    });

    var options = {
        enableCellNavigation: true,
        enableColumnReorder: false,
        multiColumnSort: false,
        forceFitColumns: true
    };

    dataView = new Slick.Data.DataView();
    var grid = new Slick.Grid("#grid", dataView, columns, options);
    var pager = new Slick.Controls.Pager(dataView, grid, $("#pager"));

    // wire up model events to drive the grid
    dataView.onRowCountChanged.subscribe(function (e, args) {
        grid.updateRowCount();
        grid.render();
    });

    dataView.onRowsChanged.subscribe(function (e, args) {
        grid.invalidateRows(args.rows);
        grid.render();
    });

    // column sorting
    sortcol = column_keys[0];
    sortdir = 1;

    function comparer(a, b) {
        var x = a[sortcol], y = b[sortcol];
        return (x == y ? 0 : (x > y ? 1 : -1));
    }

    // click header to sort grid column
    grid.onSort.subscribe(function (e, args) {
        var cols = [args];

        dataView.sort(function (dataRow1, dataRow2) {
        for (var i = 0, l = cols.length; i < l; i++) {
            sortdir = cols[i].sortAsc ? 1 : -1;
            sortcol = cols[i].sortCol.field;

            var result = cols[i].sortCol.sorter(dataRow1, dataRow2); // sorter property from column definition comes in play here
            if (result != 0) {
              return result;
            }
          }
          return 0;
        });
        args.grid.invalidateAllRows();
        args.grid.render();
    });

    // highlight row in chart
    grid.onMouseEnter.subscribe(function (e, args) {
        // Get row number from grid
        var grid_row = grid.getCellFromEvent(e).row;

        // Get the id of the item referenced in grid_row
        var item_id = grid.getDataItem(grid_row).id;
        var d = parcoords.brushed() || data;

        // Get the element position of the id in the data object
        elementPos = d.map(function (x) {
            return x.id;
        }).indexOf(item_id);

        // Highlight that element in the parallel coordinates graph
        parcoords.highlight([d[elementPos]]);
    });

    grid.onMouseLeave.subscribe(function (e, args) {
        parcoords.unhighlight();
    });

    // fill grid with data
    gridUpdate(data);

    // update grid on brush
    parcoords.on("brush", function (d) {
        gridUpdate(d);
    });

    function gridUpdate(data) {
        dataView.beginUpdate();
        dataView.setItems(data);
        dataView.endUpdate();
    }

});

// Remove all but selected from the dataset
d3.select("#keep-data")
.on("click", function() {
    new_data = parcoords.brushed();
    if (new_data.length == 0) {
        alert("Please do not select all the data when keeping/excluding");
        return false;
    }
    callUpdate(new_data);
});

// Exclude selected from the dataset
d3.select("#exclude-data")
.on("click", function() {
    new_data = _.difference(parcoords.data(), parcoords.brushed());
    if (new_data.length == 0) {
        alert("Please do not select all the data when keeping/excluding");
        return false;
    }
    callUpdate(new_data);
});


d3.select("#reset-data")
.on("click", function() {
    callUpdate(dataset);
});

d3.select("#post-data")
.on("click", function() {
    data = parcoords.data();
    data_brushed = parcoords.brushed();
    if (data_brushed) {
        data = data_brushed;
    }
    //data = _.reject(data, function (x) {
    //    return (x.MRI == "no") ? true : false;
    //});
    var keys = d3.keys(data[0]);
    //var keys = ['MRIs', 'participant_id'];
    var rows = data.map(function(row) {
        return keys.map(function(k) { return row[k]; })
    });
    var csv = d3.csv.format([keys].concat(rows)) //.replace(/\n/g,"<br/>\n");
    //var csv = d3.csv.format(rows) //.replace(/\n/g,"<br/>\n");
    var styles = "<style>body { font-family: sans-serif; font-size: 12px; }</style>";
    // window.open("text/csv").document.write(styles + csv);
    $('#csv').text(csv);
    $('#csvmodal').show();
});

var color_scale = d3.scale.linear()
.domain([-2,-0.5,0.5,2])
.range(["#DE5E60", "steelblue", "steelblue", "#98df8a"])
.interpolate(d3.interpolateLab);

function change_color(dimension) {
    parcoords.svg.selectAll(".dimension")
    .style("font-weight", "normal")
    .filter(function(d) { return d == dimension; })
    .style("font-weight", "bold")

    parcoords.color(zcolor(parcoords.data(), dimension)).render()
}

function zcolor(col, dimension) {
    var val = _(col).pluck(dimension)
    var unique_values = _(val).unique();
    if (unique_values.length < 10) {
       color = d3.scale.category10()
                       .domain(unique_values);
       return function(d) { return color(d[dimension]); }
    } else {
       z = zscore(val.map(parseFloat));
       return function(d) { return color_scale(z(d[dimension]))}
    };
};

function zscore(col) {
    var col2 = _.reject(col, _.isNaN);
    var n = col.length;
    mean = _(col2).mean();
    sigma = _(col2).stdDeviation();

    if (col2.length > 2){
        return function(d) {
            return (d-mean)/sigma;
        };
    } else{
        return function(d) {
            return 0;
        };
    };
};

function callUpdate(data) {
    parcoords.data(data).render().updateAxes();
    change_color('age');
    dataView.beginUpdate();
    dataView.setItems(data);
    dataView.endUpdate();
}

function sorterStringCompare(a, b) {
    var x = a[sortcol], y = b[sortcol];
    return sortdir * (x === y ? 0 : (x > y ? 1 : -1));
}
function sorterNumeric(a, b) {
    var x = (isNaN(a[sortcol]) || a[sortcol] === "" || a[sortcol] === null) ? -99e+10 : parseFloat(a[sortcol]);
    var y = (isNaN(b[sortcol]) || b[sortcol] === "" || b[sortcol] === null) ? -99e+10 : parseFloat(b[sortcol]);
    return sortdir * (x === y ? 0 : (x > y ? 1 : -1));
}
function sorterRating(a, b) {
    var xrow = a[sortcol], yrow = b[sortcol];
    var x = xrow[3], y = yrow[3];
    return sortdir * (x === y ? 0 : (x > y ? 1 : -1));
}
function sorterDateIso(a, b) {
    var regex_a = new RegExp("^((19[1-9][1-9])|([2][01][0-9]))\\d-([0]\\d|[1][0-2])-([0-2]\\d|[3][0-1])(\\s([0]\\d|[1][0-2])(\\:[0-5]\\d){1,2}(\\:[0-5]\\d){1,2})?$", "gi");
    var regex_b = new RegExp("^((19[1-9][1-9])|([2][01][0-9]))\\d-([0]\\d|[1][0-2])-([0-2]\\d|[3][0-1])(\\s([0]\\d|[1][0-2])(\\:[0-5]\\d){1,2}(\\:[0-5]\\d){1,2})?$", "gi");

    if (regex_a.test(a[sortcol]) && regex_b.test(b[sortcol])) {
        var date_a = new Date(a[sortcol]);
        var date_b = new Date(b[sortcol]);
        var diff = date_a.getTime() - date_b.getTime();
        return sortdir * (diff === 0 ? 0 : (date_a > date_b ? 1 : -1));
    }
    else {
        var x = a[sortcol], y = b[sortcol];
        return sortdir * (x === y ? 0 : (x > y ? 1 : -1));
    }
}

$('.rsh').draggable({
    axis: 'y'
    ,containment: 'parent'
    ,helper: 'clone'
    , start: function(event, ui) {
        $(this).attr('start_offset',$(this).offset().top);
        $(this).attr('start_next_height',$(this).next().height());
    }
    ,drag: function (event, ui) {
        var prev_element=$(this).prev();
        var next_element=$(this).next();
        var y_difference=$(this).attr('start_offset')-ui.offset.top;
        prev_element.height(ui.offset.top-prev_element.offset().top);
        next_element.height(parseInt($(this).attr('start_next_height'))+y_difference);
    }
});
