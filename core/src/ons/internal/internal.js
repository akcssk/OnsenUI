/*
Copyright 2013-2015 ASIAL CORPORATION

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*/

import platform from '../platform';
import pageAttributeExpression from '../page-attribute-expression';

const internal = {};

internal.config = {
  autoStatusBarFill: true,
  animationsDisabled: false
};

internal.nullElement = window.document.createElement('div');

/**
 * @return {Boolean}
 */
internal.isEnabledAutoStatusBarFill = () => {
  return !!internal.config.autoStatusBarFill;
};

/**
 * @param {String} html
 * @return {String}
 */
internal.normalizePageHTML = html => {
  html = ('' + html).trim();

  if (!html.match(/^<ons-page/)) {
    html = '<ons-page _muted>' + html + '</ons-page>';
  }

  return html;
};

internal.waitDOMContentLoaded = callback => {
  if (window.document.readyState === 'loading' || window.document.readyState == 'uninitialized') {
    window.document.addEventListener('DOMContentLoaded', callback);
  } else {
    setImmediate(callback);
  }
};

internal.autoStatusBarFill = action => {
  const onReady = () => {
    if (internal.shouldFillStatusBar()) {
      action();
    }
    document.removeEventListener('deviceready', onReady);
    document.removeEventListener('DOMContentLoaded', onReady);
  };

  if (typeof device === 'object') {
    document.addEventListener('deviceready', onReady);
  } else if (['complete', 'interactive'].indexOf(document.readyState) === -1) {
    document.addEventListener('DOMContentLoaded', function() {
      onReady();
    });
  } else {
    onReady();
  }
};

internal.shouldFillStatusBar = () => internal.isEnabledAutoStatusBarFill() && platform.isWebView() && platform.isIOS7above();

internal.templateStore = {
  _storage: {},

  /**
   * @param {String} key
   * @return {String/null} template
   */
  get(key) {
    return internal.templateStore._storage[key] || null;
  },

  /**
   * @param {String} key
   * @param {String} template
   */
  set(key, template) {
    internal.templateStore._storage[key] = template;
  }
};

window.document.addEventListener('_templateloaded', function(e) {
  if (e.target.nodeName.toLowerCase() === 'ons-template') {
    internal.templateStore.set(e.templateId, e.template);
  }
}, false);

window.document.addEventListener('DOMContentLoaded', function() {
  register('script[type="text/ons-template"]');
  register('script[type="text/template"]');
  register('script[type="text/ng-template"]');

  function register(query) {
    const templates = window.document.querySelectorAll(query);
    for (let i = 0; i < templates.length; i++) {
      internal.templateStore.set(templates[i].getAttribute('id'), templates[i].textContent);
    }
  }
}, false);

/**
 * @param {String} page
 * @return {Promise}
 */
internal.getTemplateHTMLAsync = function(page) {
  return new Promise((resolve, reject) => {
    setImmediate(() => {
      const cache = internal.templateStore.get(page);

      if (cache) {
        const html = typeof cache === 'string' ? cache : cache[1];
        resolve(html);
      } else {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', page, true);
        xhr.onload = function(response) {
          const html = xhr.responseText;
          if (xhr.status >= 400 && xhr.status < 600) {
            reject(html);
          }
          else {
            resolve(html);
          }
        };
        xhr.onerror = function() {
          throw new Error(`The page is not found: ${page}`);
        };
        xhr.send(null);
      }
    });
  });
};

/**
 * @param {String} page
 * @return {Promise}
 */
internal.getPageHTMLAsync = function(page) {
  const pages = pageAttributeExpression.evaluate(page);

  const getPage = (page) => {
    if (typeof page !== 'string') {
      return Promise.reject('Must specify a page.');
    }

    return internal.getTemplateHTMLAsync(page)
      .then(
        function(html) {
          return internal.normalizePageHTML(html);
        },
        function(error) {
          if (pages.length === 0) {
            return Promise.reject(error);
          }

          return getPage(pages.shift());
        }
      )
      .then(html => internal.normalizePageHTML(html));
  };

  return getPage(pages.shift());
};

export default internal;
