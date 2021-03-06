import {
  EventEmitter
}
from 'events';

import SiteContext from './SiteContext';

async function prepareDownload(site, context) {
  var callbacks = site.downloadCallbacks;
  var id = await Promise.try(callbacks.getID, context);
  var rawMeta, pipeArgs, parsedMeta;
  try {
    rawMeta = await context.getCached(id);
    debug('WorkCache')('Hit', rawMeta);
  } catch(e) {
    debug('WorkCache')('Miss');
    rawMeta = await Promise.try(callbacks.getRawMetadata, [id, context]);
    context.setCache(id, rawMeta);
  }

  pipeArgs = (function() {
    var args = [];

    if (typeof callbacks.metaTransform == 'function') {
      args = [callbacks.metaTransform];
    } else if (Array.isArray(callbacks.metaTransform)) {
      args = callbacks.metaTransform;
    } else {
      throw new TypeError('metaTransform should be Array or Function');
    }

    return args;
  }());

  parsedMeta = await Promise.try(callbacks.parsePages, [
    context,
    R.pipe.apply(this, pipeArgs)(rawMeta),
    rawMeta
  ]);

  if (parsedMeta.pages.length === 1) {
    context.showButton();
  }

  context.postMeta(parsedMeta);
}

function initMarking(site, context){
  var callbacks = site.markingCallbacks, enabled = false;

  function updateClass(id, elem) {
    context.isDownloaded(id).then(function (exist) {
      if (exist) {
        elem.addClass('pxtool-dl-mark');
      }
    });
  }

  function injectCSS(color) {
    var $ = require('jquery');
    var cssText = '';
    var el = $('#pxtool-css');
    if (enabled) { // clear all css if disabled
      cssText = `
      .pxtool-dl-mark {
        background-color: ${color} !important;
      }
      `;
    }

    if (el.length === 0) { // create one
      el = $('<style id="pxtool-css" type="text/css"></style>').appendTo('head');
    }
    el.html(cssText);
  }

  function onConfigUpdated(config){
    enabled = config.markingEnabled;
    injectCSS(config.color);
  }

  function onHistoryUpdated(){
    Promise.try(callbacks.getElements).then(function (elems) {
      elems.forEach(function (elem) {
        updateClass(elem.id, elem.element);
      });
    });
  }

  callbacks.init(context).then(function () {
    context.getConfig().then(onConfigUpdated).then(onHistoryUpdated);
    context.on('configUpdated', onConfigUpdated);
    context.on('historyUpdated', onHistoryUpdated);
  }).catch(R.identity);
}


class SiteRegistry extends EventEmitter {
  constructor() {
    super();
    this.sites = [];
    this.ready = new Promise(resolve => {
      this.regsterDone = resolve;
    });
  }

  register(site) {
    if (site.marking) {
      site.config.push({
        name: 'markingEnabled',
        msgid: 'common_mark_downloaded',
        type: 'checkbox',
        default: true
      });
      site.config.push({
        name: 'color',
        msgid: 'common_mark_color',
        type: 'color',
        default: site.defaultMarkColor || '#FFA07A'
      });
    }
    this.sites.push(site);
  }

  filterAndRun(location) {
    this.sites.forEach(site => {
      var context;
      if (R.allPass(site.enableCondition, location)) {
        context = new SiteContext(site);

        if (R.allPass(site.downloadableCondition, location)) {
          process.nextTick(prepareDownload.bind(null, site, context));
        }

        if (site.marking) {
          process.nextTick(initMarking.bind(null, site, context));
        }
      }
    });
  }

  getOptionsConfig() {
    return this.sites.map(site => {
      return {
        name: site.name,
        fields: site.config,
        namespace: site.namespace,
        templateConfig: site.template
      };
    });
  }
}

module.exports = new SiteRegistry();
