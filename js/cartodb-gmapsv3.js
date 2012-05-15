/**
 * @name cartodb-gmapsv3 for Google Maps V3 API
 * @version 0.32 [April 16, 2012]
 * @author: jmedina@vizzuality.com
 * @fileoverview <b>Author:</b> jmedina@vizzuality.com<br/> <b>Licence:</b>
 *               Licensed under <a
 *               href="http://opensource.org/licenses/mit-license.php">MIT</a>
 *               license.<br/> This library lets you use CartoDB with google
 *               maps v3.
 *                 
 */
/**
 * @name google
 * @class The fundamental namespace for Google APIs 
 */
/**
 * @name google.maps
 * @class The fundamental namespace for Google Maps V3 API 
 */
 /*
 *  - Map style of cartodb
 *  - Infowindow of cartodb
 *  - Tiles style of cartodb
 */

// Namespace
var CartoDB = CartoDB || {};

(function($) {
  if (typeof(google.maps.CartoDBLayer) === "undefined") {
    /**
     * @params {}
     *    map_canvas    -     Gmapsv3 canvas id (necesary for showing the infowindow)
     *    map           -     Your gmapsv3 map
     *    user_name     -     CartoDB user name
     *    table_name    -     CartoDB table name
     *    query         -     If you want to apply any sql sentence to the table...
     *    tile_style    -     If you want to add other style to the layer
     *    map_style     -     If you want to see the map styles created on cartodb (opcional - default = false)
     *    infowindow    -     If you want to see infowindows when click in a geometry (opcional - default = false)
     *    auto_bound    -     Let cartodb auto-bound-zoom in the map (opcional - default = false)
     *    debug         -     Do you want to debug the library? Set it to true
     */

    google.maps.CartoDBLayer = function (params) {

      this.params = params;
      this.params.feature = params.infowindow;

      if (this.params.map_style)  setCartoDBMapStyle(this.params);    // Map style? ok, let's style.
      if (this.params.auto_bound)   autoBound(this.params);           // Bounds? CartoDB does it.

      if (this.params.infowindow) {
        addWaxCartoDBTiles(this.params);
      } else {
        addSimpleCartoDBTiles(this.params);                           // Always add cartodb tiles, simple or with wax.
      }

      this.params.visible = true;
      this.params.active = true;

      // Zoom to cartodb geometries
      function autoBound(params) {
        // Zoom to your geometries
        $.ajax({
          url:'http://'+params.user_name+'.cartodb.com/api/v1/sql/?q='+escape('select ST_Extent(the_geom) from '+ params.table_name),
          dataType: 'jsonp',
          timeout: 2000,
          callbackParameter: 'callback',
          success: function(result) {
            if (result.rows[0].st_extent!=null) {
              var coordinates = data.rows[0].st_extent.replace('BOX(','').replace(')','').split(',')
                , coor1 = coordinates[0].split(' ')
                , coor2 = coordinates[1].split(' ');

              var lon0 = coor1[0]
                , lat0 = coor1[1]
                , lon1 = coor2[0]
                , lat1 = coor2[1];

              // Check bounds

              var minlat = -85.0511
                , maxlat =  85.0511
                , minlon = -179
                , maxlon =  179;

              /* Clamp X to be between min and max (inclusive) */
              var clampNum = function(x, min, max) {
                return x < min ? min : x > max ? max : x;
              }

              lon0 = clampNum(lon0, minlon, maxlon);
              lon1 = clampNum(lon1, minlon, maxlon);
              lat0 = clampNum(lat0, minlat, maxlat);
              lat1 = clampNum(lat1, minlat, maxlat);

              var sw = new google.maps.LatLng(lat0, lon0)
                , ne = new google.maps.LatLng(lat1, lon1)
                , bounds = new google.maps.LatLngBounds(sw,ne);

              params.map.fitBounds(bounds);
            }
          },
          error: function(e,msg) {
            if (params.debug) throw('Error getting table bounds: ' + msg);
          }
        });
      }

      // Set the map styles of your cartodb table/map
      function setCartoDBMapStyle(params) {
        $.ajax({
          url: 'http://' + params.user_name + '.cartodb.com/tiles/' + params.table_name + '/map_metadata?callback=?',
          dataType: 'jsonp',
          timeout: 2000,
          callbackParameter: 'callback',
          success: function(result) {
            var map_style = $.parseJSON(result.map_metadata);

            if (!map_style || map_style.google_maps_base_type=="roadmap") {
              params.map.setOptions({mapTypeId: google.maps.MapTypeId.ROADMAP});
            } else if (map_style.google_maps_base_type=="satellite") {
              params.map.setOptions({mapTypeId: google.maps.MapTypeId.SATELLITE});
            } else if (map_style.google_maps_base_type=="terrain") {
              params.map.setOptions({mapTypeId: google.maps.MapTypeId.TERRAIN});
            } else {
              var mapStyles = [ { stylers: [ { saturation: -65 }, { gamma: 1.52 } ] },{ featureType: "administrative", stylers: [ { saturation: -95 }, { gamma: 2.26 } ] },{ featureType: "water", elementType: "labels", stylers: [ { visibility: "off" } ] },{ featureType: "administrative.locality", stylers: [ { visibility: "off" } ] },{ featureType: "road", stylers: [ { visibility: "simplified" }, { saturation: -99 }, { gamma: 2.22 } ] },{ featureType: "poi", elementType: "labels", stylers: [ { visibility: "off" } ] },{ featureType: "road.arterial", stylers: [ { visibility: "off" } ] },{ featureType: "road.local", elementType: "labels", stylers: [ { visibility: "off" } ] },{ featureType: "transit", stylers: [ { visibility: "off" } ] },{ featureType: "road", elementType: "labels", stylers: [ { visibility: "off" } ] },{ featureType: "poi", stylers: [ { saturation: -55 } ] } ];
              map_style.google_maps_customization_style = mapStyles;
              params.map.setOptions({mapTypeId: google.maps.MapTypeId.ROADMAP});
            }

            // Custom tiles
            if (!map_style) {
              map_style = {google_maps_customization_style: []};
            }
            params.map.setOptions({styles: map_style.google_maps_customization_style});
          },
          error: function(e, msg) {
            if (params.debug) throw('Error getting map style: ' + msg);
          }
        });
      }

      // Add cartodb tiles to the map
      function addSimpleCartoDBTiles(params) {
        // Add the cartodb tiles
        var cartodb_layer = {
          getTileUrl: function(coord, zoom) {
            return 'http://' + params.user_name + '.cartodb.com/tiles/' + params.table_name + '/'+zoom+'/'+coord.x+'/'+coord.y+'.png?sql='+params.query.replace(/\{\{table_name\}\}/g,params.table_name) + '&style=' + ((params.tile_style)?encodeURIComponent(params.tile_style.replace(/\{\{table_name\}\}/g,params.table_name)):'');
          },
          tileSize: new google.maps.Size(256, 256),
          name: params.query,
          description: false
        };
        params.layer = new google.maps.ImageMapType(cartodb_layer);
        params.map.overlayMapTypes.insertAt(0,params.layer);
      }

      // Add cartodb tiles to the map
      function addWaxCartoDBTiles(params) {
        // interaction placeholder
        var currentCartoDbId;

        params.tilejson = generateTileJson(params);
        params.infowindow = new CartoDB.Infowindow(params);
        params.cache_buster = 0;

        params.waxOptions = {
          callbacks: {
            out: function(){
              params.map.setOptions({draggableCursor: 'default'});
            },
            over: function(feature, div, opt3, evt){
              params.map.setOptions({draggableCursor: 'pointer'});
            },
            click: function(feature, div, opt3, evt){
              // If there are more than one cartodb layer, close all possible infowindows
              params.infowindow.hideAll();
              params.infowindow.open(feature,evt.latLng);
            }
          },
          clickAction: 'full'
        };
        
        params.layer = new wax.g.connector(params.tilejson);
  
        params.map.overlayMapTypes.insertAt(0,params.layer);
        params.interaction = wax.g.interaction(params.map, params.tilejson, params.waxOptions);
        console.log(params.interaction);
      }

      // Refresh wax interaction
      function refreshWax(params) {
        if (params.infowindow) {
          params.cache_buster++;
          params.query = params.query;
          params.tilejson = generateTileJson(params);
  
          // Setup new wax
          params.tilejson.grids = wax.util.addUrlData(params.tilejson.grids_base,  'cache_buster=' + params.cache_buster);
  
          // Add map tiles
          params.layer = new wax.g.connector(params.tilejson);
          params.map.overlayMapTypes.insertAt(0,params.layer);
  
          // Add interaction
          params.interaction.remove();
          params.interaction = wax.g.interaction(params.map, params.tilejson, params.waxOptions);
        }
      }

      function generateTileJson(params) {
        var core_url = 'http://' + params.user_name + '.cartodb.com';  
        var base_url = core_url + '/tiles/' + params.table_name + '/{z}/{x}/{y}';
        var tile_url = base_url + '.png?cache_buster=0';
        var grid_url = base_url + '.grid.json';

        // SQL?
        if (params.query) {
          var query = 'sql=' + encodeURIComponent(params.query.replace(/\{\{table_name\}\}/g,params.table_name));
          tile_url = wax.util.addUrlData(tile_url, query);
          grid_url = wax.util.addUrlData(grid_url, query);
        }

        // Tiles style ?
        if (params.tile_style) {
          var style = 'style=' + encodeURIComponent(params.tile_style.replace(/\{\{table_name\}\}/g,params.table_name));
          tile_url = wax.util.addUrlData(tile_url,style);
          grid_url = wax.util.addUrlData(grid_url,style);
        }

        // Build up the tileJSON
        // TODO: make a blankImage a real 'empty tile' image
        return {
          blankImage: 'blank_tile.png', 
          tilejson: '1.0.0',
          scheme: 'xyz',
          tiles: [tile_url],
          grids: [grid_url],
          tiles_base: tile_url,
          grids_base: grid_url,
          name: params.query,
          description: true,
          formatter: function(options, data) {
            currentCartoDbId = data.cartodb_id;
            return data.cartodb_id;
          },
          cache_buster: function(){
            return params.cache_buster;
          }
        };
      }

      // Remove old cartodb layer added (wax or imagemaptype)
      function removeOldLayer(params) {
        if (params.layer) {
          var pos = -1;
          params.map.overlayMapTypes.forEach(function(map_type,i){
            if (params.layer == map_type && map_type.name == params.layer.name && map_type.description == params.layer.description) {
              pos = i;
            }
          });
          if (pos!=-1) 
            params.map.overlayMapTypes.removeAt(pos);
          params.layer = null;
        }
      }
      

      // Update tiles & interactivity layer;
      google.maps.CartoDBLayer.prototype.update = function(changes) {

        // Destroy the infowindow if existed
        if (this.params.infowindow) 
          this.params.infowindow.destroy();
        
				// What do we support change? - tile_style | query | infowindow
				if (typeof changes == 'object') {
					for (var param in changes) {
						console.log(param);
		      	if (param != "tile_style" && param != "query" && param != "infowindow") {
			      	if (this.params.debug) {
			      		throw("Sorry, you can't update " + param);
			      	} else {
			      		return;
			      	}
			      } else {
			      	this.params[param] = changes[param];
			      }					
					}

				} else {
					if (this.params.debug) {
	      		throw("This method only accepts a javascript object");
	      	} else {
	      		return;
	      	}
				}

        // Removes previous tiles
        removeOldLayer(this.params);

        // Add new one updated
	      if (this.params.infowindow)
				  refreshWax(this.params);
				else
				  addSimpleCartoDBTiles(this.params);

        this.params.active = true;
        this.params.visible = true;
      };
  

      // Destroy layers from the map
      google.maps.CartoDBLayer.prototype.destroy = function() {
        // First remove previous cartodb - tiles.
        removeOldLayer(this.params.map,this.params.layer);

        if (this.params.infowindow) {
          // Remove wax interaction
          this.params.interaction.remove();
          this.params.infowindow.hide();
        }

        this.params.active = false;
      };
  
      // Hide layers from the map
      google.maps.CartoDBLayer.prototype.hide = function() {
        this.destroy();
        this.params.visible = false;
      };

      // Show layers from the map
      google.maps.CartoDBLayer.prototype.show = function() {
        if (!this.params.visible || !this.params.active) {
          this.update(this.params.query);
          this.params.visible = true;
        }
      };

      // CartoDB layer visible?
      google.maps.CartoDBLayer.prototype.isVisible = function() {
        return this.params.visible;
      };
    };
  }

  /**
   * CartoDB.Infowindow
   * @xavijam
   **/
  CartoDB.Infowindow = function (params) {
    this.latlng_ = new google.maps.LatLng(0,0);
    this.feature_;
    this.map_ = params.map;
    this.columns_;
    this.offsetHorizontal_ = -107;
    this.width_ = 214;
    this.setMap(params.map);
    this.params_ = params;
  };

  CartoDB.Infowindow.prototype = new google.maps.OverlayView();

  CartoDB.Infowindow.prototype.draw = function() {
    var me = this;

    var div = this.div_;
    if (!div) {
      div = this.div_ = document.createElement('DIV');
      div.className = "cartodb_infowindow";

      div.innerHTML = '<a href="#close" class="close">x</a>'+
                      '<div class="outer_top">'+
                        '<div class="top">'+
                        '</div>'+
                      '</div>'+
                      '<div class="bottom">'+
                        '<label>id:1</label>'+
                      '</div>';

      $(div).find('a.close').click(function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        me.hide();
      });

      google.maps.event.addDomListener(div, 'click', function (ev) {
        ev.preventDefault ? ev.preventDefault() : ev.returnValue = false;
      });
      google.maps.event.addDomListener(div, 'dblclick', function (ev) {
        ev.preventDefault ? ev.preventDefault() : ev.returnValue = false;
      });
      google.maps.event.addDomListener(div, 'mousedown', function (ev) {
        ev.preventDefault ? ev.preventDefault() : ev.returnValue = false;
        ev.stopPropagation ? ev.stopPropagation() : window.event.cancelBubble = true;
      });
      google.maps.event.addDomListener(div, 'mouseup', function (ev) {
        ev.preventDefault ? ev.preventDefault() : ev.returnValue = false;
      });
      google.maps.event.addDomListener(div, 'mousewheel', function (ev) {
      	ev.stopPropagation ? ev.stopPropagation() : window.event.cancelBubble = true;
      });
      google.maps.event.addDomListener(div, 'DOMMouseScroll', function (ev) {
      	ev.stopPropagation ? ev.stopPropagation() : window.event.cancelBubble = true;
      });

      var panes = this.getPanes();
      panes.floatPane.appendChild(div);

      div.style.opacity = 0;
    }

    var pixPosition = this.getProjection().fromLatLngToDivPixel(this.latlng_);
    if (pixPosition) {
      div.style.width = this.width_ + 'px';
      div.style.left = (pixPosition.x - 49) + 'px';
      var actual_height = - $(div).height();
      div.style.top = (pixPosition.y + actual_height + 5) + 'px';
    }
  };

  CartoDB.Infowindow.prototype.setPosition = function() {
    if (this.div_) { 
       var div = this.div_;
       var pixPosition = this.getProjection().fromLatLngToDivPixel(this.latlng_);
       if (pixPosition) {
         div.style.width = this.width_ + 'px';
         div.style.left = (pixPosition.x - 49) + 'px';
         var actual_height = - $(div).height();
         div.style.top = (pixPosition.y + actual_height + 10) + 'px';
       }
       this.show();
    }
  };

  CartoDB.Infowindow.prototype.open = function(feature,latlng){
    var that = this
      , infowindow_sql = 'SELECT * FROM ' + this.params_.table_name + ' WHERE cartodb_id=' + feature;
    that.feature_ = feature;

    // If the table is private, you can't run any api methods
    if (this.params_.feature!=false) {
      infowindow_sql = this.params_.feature.replace('{{feature}}',feature);
    }

    // Replace {{table_name}} for table name
    infowindow_sql = encodeURIComponent(infowindow_sql.replace(/\{\{table_name\}\}/g,this.params_.table_name));

    $.ajax({
      url:'http://'+ this.params_.user_name +'.cartodb.com/api/v1/sql/?q='+infowindow_sql,
      dataType: 'jsonp',
      timeout: 2000,
      callbackParameter: 'callback',
      success: function(result) {
        positionateInfowindow(result.rows[0],latlng);
      },
      error: function(e,msg) {
        if (that.params_.debug) throw('Error retrieving infowindow variables: ' + msg);
      }
    });

    function positionateInfowindow(variables,center) {
      if (that.div_) {
        var div = that.div_;
        // Get latlng position
        that.latlng_ = latlng;

        // Remove the unnecessary html
        $('div.cartodb_infowindow div.outer_top div.top').html('');
        $('div.cartodb_infowindow div.outer_top div.bottom label').html('');

        // List all the new variables
        for (p in variables) {
          if (p!='cartodb_id' && p!='cdb_centre' && p!='the_geom_webmercator') {
            $('div.cartodb_infowindow div.outer_top div.top').append('<label>'+p+'</label><p class="'+((variables[p]!=null && variables[p]!='')?'':'empty')+'">'+(variables[p] || 'empty')+'</p>');
          }
        }

        // Show cartodb_id?
        if (variables['cartodb_id']) {
          $('div.cartodb_infowindow div.bottom label').html('id: <strong>'+feature+'</strong>');
        }

        that.moveMaptoOpen();
        that.setPosition();
      }
    }
  };

  CartoDB.Infowindow.prototype.hide = function() {
    if (this.div_) {
      var div = this.div_;
      $(div).animate({
        top: '+=' + 10 + 'px',
        opacity: 0},
        100, 'swing',
        function () {
          div.style.visibility = "hidden";
        }
      );
    }
  };

  CartoDB.Infowindow.prototype.show = function() {
    if (this.div_) {
      var div = this.div_;
      div.style.opacity = 0;
      div.style.visibility = "visible";
      $(div).animate({
        top: '-=' + 10 + 'px',
        opacity: 1},
        250
      );
    }
  };

  CartoDB.Infowindow.prototype.destroy = function() {
    // Check if the overlay was on the map and needs to be removed.
    if (this.div_) {
      this.div_.parentNode.removeChild(this.div_);
      this.div_ = null;
    }
  };

  CartoDB.Infowindow.prototype.hideAll = function() {
    $('div.cartodb_infowindow').css('visibility','hidden');
  };

  CartoDB.Infowindow.prototype.isVisible = function(marker_id) {
    if (this.div_) {
      var div = this.div_;
      if (div.style.visibility == 'visible' && this.feature_!=null) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  };

  CartoDB.Infowindow.prototype.moveMaptoOpen = function() {
    var left = 0;
    var top = 0;
    var div = this.div_;
    var pixPosition = this.getProjection().fromLatLngToContainerPixel(this.latlng_);

    if ((pixPosition.x + this.offsetHorizontal_) < 0) {
      left = (pixPosition.x + this.offsetHorizontal_ - 20);
    }

    if ((pixPosition.x + 180) >= ($('#'+this.params_.map_canvas).width())) {
      left = (pixPosition.x + 180 - $('#'+this.params_.map_canvas).width());
    }

    if ((pixPosition.y - $(div).height()) < 0) {
      top = (pixPosition.y - $(div).height() - 30);
    }

    this.map_.panBy(left,top);
  };

})(jQuery);
