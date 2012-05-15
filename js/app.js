/*http://wiki.openstreetmap.org/wiki/Madrid*/
$(function(){
    var layer, map, waxInteraction, infoWindow;
    
    //
    // Builds the sql with the filters selected by the user
    //
    var sqlBuilder = function() {
        var sql = 'SELECT g1.cartodb_id, g1.the_geom, g1.the_geom_webmercator FROM flats As g1',
            roomsRange = [],
            priceRange = [],
            nearToPark,
            metroLine;
        return {
            setRooms: function(values){
                roomsRange = values;
            },
            setPrice: function(values){
                priceRange = values;
            },
            setNearToPark: function(value){
                nearToPark = value;
            },
            setMetroLine: function(value){
                metroLine = value;
            },
            getQuery: function(){
                var filters = [];
                var joins = [];
                if(roomsRange.length > 0){
                    filters.push('rooms BETWEEN ' + encodeURIComponent(roomsRange[0] + ' AND ' + encodeURIComponent(roomsRange[1])));
                }
                if(priceRange.length > 0){
                    filters.push('price BETWEEN ' + encodeURIComponent(priceRange[0]) + ' AND ' + encodeURIComponent(priceRange[1]));
                }
                if(nearToPark){
                    joins.push('madrid_gardens as g2');
                    filters.push('g1.cartodb_id <> g2.cartodb_id AND ST_DWithin(g1.the_geom, g2.the_geom, 0.005)');
                }
                if(metroLine){
                    joins.push('madrid_tube as g3');
                    filters.push('g1.cartodb_id <> g3.cartodb_id AND ST_DWithin(g1.the_geom, g3.the_geom, 0.005) AND g3.line=\''+encodeURIComponent(metroLine)+'\'');
                }
                var join = joins.join(',');
                if(join) join = ',' + join;
                var filter = filters.join(' AND ');
                if(filter) filter = ' WHERE ' + filter;
                
                return sql + join + filter;
                
            }
        }
    }();
    
    //
    // Handles DOM Events
    //
    $('#price-slider').slider({
        range: true,
        max: 1000,
        step: 50,
        values: [0, 1000],
        change: function(event, ui){
            sqlBuilder.setPrice(ui.values);
            updateLayer();
        },
        slide: function(event, ui){
            var text = "&euro; " + ui.values[0] + "  &euro; - " + ui.values[1];
            $('#price').html(text);
        }
    });
    $("#price").html("&euro; 0 - &euro; 1000");
    
    $("#rooms-slider").slider({
        range: true,
        max: 10,
        min: 1,
        values: [1, 10],
        change: function(event, ui){
            sqlBuilder.setRooms(ui.values);
            updateLayer();
        },
        slide: function(event, ui){
            var text = ui.values[0] + ' - ' + ui.values[1];
            $('#rooms').html(text);
        }
    });
    $("#rooms").html("1 - 10");
    
    $("#parks").change(function(){
        sqlBuilder.setNearToPark($(this).attr("checked") != undefined);
        updateLayer();
    });
    
    $(".metro").click(function(){
        var $this = $(this);
        var id = $this.attr('id');
        $('#metro-value').text(id);
        $('.btn-group').removeClass('open');
        if(id == 'Indiferent') id = 0;
        sqlBuilder.setMetroLine(id);
        updateLayer();
        return false;
    });
    
    //
    // Creates the map
    //
    (function(){
        var cartodbMapOptions = {
            zoom: 13,
            center: new google.maps.LatLng(40.439631,-3.695526),
            disableDefaultUI: true,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        }
        map = new google.maps.Map(document.getElementById('map'), cartodbMapOptions);
    })();
        
    var waxOptions = {
        callbacks: {
            out: function(){
                map.setOptions({draggableCursor: 'default'});
            },
            over: function(feature, div, opt3, evt){
                map.setOptions({draggableCursor: 'pointer'});
            },
            click: function(feature, div, opt3, evt){
               
                getFlatInfo(feature, function(content){
                    infoWindow && infoWindow.close();
                    infoWindow = new google.maps.InfoWindow({
                        content: content,
                        position: evt.latLng
                    });
                    infoWindow.open(map);
                });
                
            }
        },
        clickAction: 'full'
    };
    
    //
    // Removes and reloads the layer with the flat's information
    //
    function updateLayer()
    {
        infoWindow && infoWindow.close();
        map.overlayMapTypes.forEach(function(map_type,i){
            if (layer == map_type && map_type.name == layer.name && map_type.description == layer.description) {
              pos = i;
            }
          });
          if (pos!=-1) 
            map.overlayMapTypes.removeAt(pos);
        loadLayer();
    }
    
    //
    // Loads the layer with the flat's information
    //
    function loadLayer()
    {
        var baseUrl = 'http://ivanguardado.cartodb.com/tiles/flats/{z}/{x}/{y}';
        var tileUrl = baseUrl + '.png?cache_buster=0'+'&sql='+sqlBuilder.getQuery();
        var gridUrl = baseUrl + '.grid.json?sql='+sqlBuilder.getQuery();
        var tileOptions = {
            blankImage: 'blank_tile.png',
            tilejson: '1.0.0',
            scheme: 'xyz',
            tiles: [tileUrl],
            grids: [gridUrl],
            tiles_base: tileUrl,
            grids_base: gridUrl,
            name: 'query',
            description: true,
            formatter: function(options, data) {
                return data.cartodb_id;
            }
        }
        layer = new wax.g.connector(tileOptions);
        map.overlayMapTypes.insertAt(0,layer);
        if(waxInteraction){
            waxInteraction.remove();
        }
        waxInteraction = wax.g.interaction(map, tileOptions, waxOptions); 
    };
    
    //
    // Loads info for a specified flat
    //
    function getFlatInfo(feature, callback){
        var infowindow_sql = 'SELECT * FROM flats WHERE cartodb_id=' + feature;
        $.ajax({
          url:'http://ivanguardado.cartodb.com/api/v1/sql/?q='+infowindow_sql,
          dataType: 'jsonp',
          timeout: 2000,
          callbackParameter: 'callback',
          success: function(result) {
            callback(infoWindowFormatter(result.rows[0]));
          }
        });
    }
    
    function infoWindowFormatter(data){
        return '<strong>'+data.name+'</strong>'+
                '<ul class="unstyled">'+
                '<li>'+data.type+'</li>'+
                '<li>'+data.price+'&euro; / month (+'+ data.price_invoices+'&euro; invoices)</li>'+
                '<li><a href="http://erasmusu.com/'+data.url+'">See more &#8594;</a></li>'+
                '</ul>';
    }
    
    // Initialize the layer
    loadLayer();
});
