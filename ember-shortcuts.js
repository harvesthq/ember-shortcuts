;(function(Ember, $) {
  var objectKeys = Object.keys || Ember.keys;

  var MODIFIERS = {
    '⇧': 16, shift: 16,
    '⌥': 18, alt: 18, option: 18,
    '⌃': 17, ctrl: 17, control: 17,
    '⌘': 91, command: 91
  };

  var DEFINITIONS = {
    backspace: 8, tab: 9, clear: 12,
    enter: 13, 'return': 13,
    esc: 27, escape: 27, space: 32,
    left: 37, up: 38,
    right: 39, down: 40,
    del: 46, 'delete': 46,
    home: 36, end: 35,
    pageup: 33, pagedown: 34,
    ',': 188, '.': 190, '/': 191,
    '`': 192, '-': 189, '=': 187,
    ';': 186, '\'': 222,
    '[': 219, ']': 221, '\\': 220
  };

  for (var n = 1; n < 20; n++) DEFINITIONS['f'+n] = 111 + n;

  function code(c) {
    return DEFINITIONS[c] || MODIFIERS[c] || c.toUpperCase().charCodeAt(0);
  }

  var ENABLED = true;
  var PRESSED = {};
  var PRESSED_MODS = {};
  var SHORTCUTS = {};

  function normalize(keyCode) {
    switch (keyCode) {
      case 93: case 224: return 91; // Firefox does ⌘  weird
      case 61: return 187;          // and `=`
      case 173: return 189;         // and `-`
      default: return keyCode;
    }
  }

  function isMod(keyCode) {
    return keyCode === 16 || keyCode === 17 || keyCode === 18 || keyCode === 91;
  }

  function updatePressedMods(event, keyCode) {
    if (event.shiftKey) PRESSED_MODS[16] = true;
    if (event.ctrlKey)  PRESSED_MODS[17] = true;
    if (event.altKey)   PRESSED_MODS[18] = true;
    if (event.metaKey)  PRESSED_MODS[91] = true;
  }

  function filter(filters, event) {
    return !filters.any(function(filter) {
      return !filter(event);
    });
  }

  function triggerEvent(filters, event, keyCode, callback) {
    if (!ENABLED) return;
    if (!filter(filters, event)) return;
    if (!(keyCode in SHORTCUTS)) return;

    SHORTCUTS[keyCode].forEach(function(parsedKeyBinding) {
      if (!isMod(keyCode) && !modsMatch(parsedKeyBinding)) return;
      Ember.run(function() { callback(parsedKeyBinding, event); });
    });
  }

  function makeTriggerShortcut(router, callback) {
    return function triggerShortcut(parsedKeyBinding, event) {
      var actionOrObject, infos;

      if (!(infos = router.currentHandlerInfos)) return;

      for (var i = infos.length - 1; i >= 0; i--) {
        var handler = infos[i].handler;

        if (handler.shortcuts && (actionOrObject = handler.shortcuts[parsedKeyBinding.raw])) {
          return callback(handler, actionOrObject);
        }
      }
    };
  }

  function makeKeyDownDispatch(router, filters) {
    var triggerKeyDownShortcut = makeTriggerShortcut(router, function(handler, actionOrObject) {
      if (typeof actionOrObject === 'string') {
        handler.send(actionOrObject, event);
      } else {
        handler.send(actionOrObject.keyDown, event);
      }
    });

    return function dispatchKeyDownShortcut(event) {
      var keyCode = normalize(event.keyCode);

      PRESSED[keyCode] = true;
      if (isMod(keyCode)) {
        PRESSED_MODS[keyCode] = true;
      }

      updatePressedMods(event, keyCode);
      triggerEvent(filters, event, keyCode, triggerKeyDownShortcut);
    };
  }

  function makeKeyUpDispatch(router, filters) {
    var triggerKeyUpShortcut = makeTriggerShortcut(router, function(handler, actionOrObject) {
      if (typeof actionOrObject === 'object') {
        handler.send(actionOrObject.keyUp, event);
      }
    });

    return function dispatchKeyUpShortcut(event) {
      var keyCode = normalize(event.keyCode);

      if (PRESSED[keyCode]) PRESSED[keyCode] = undefined;
      if (PRESSED_MODS[keyCode]) PRESSED_MODS[keyCode] = undefined;

      triggerEvent(filters, event, keyCode, triggerKeyUpShortcut);
    };
  }

  function reset() {
    PRESSED = {};
    PRESSED_MODS = {};
  }

  function modsMatch(parsedKeyBinding) {
    var mods = parsedKeyBinding.mods;
    return mods[16] === PRESSED_MODS[16] && mods[17] === PRESSED_MODS[17] &&
           mods[18] === PRESSED_MODS[18] && mods[91] === PRESSED_MODS[91];
  }

  function parse(spec) {
    var parts = spec.replace(/\s+/g, '').split('+');
    var keyCode = code(parts.pop());
    var m, mods = {};

    parts.forEach(function(part) {
      if (m = MODIFIERS[part]) mods[m] = true;
    });

    return { mods: mods, keyCode: keyCode, raw: spec };
  }

  function register(shortcuts) {
    shortcuts.forEach(function(spec) {
      var parsedKeyBinding = parse(spec);
      if (!(parsedKeyBinding.keyCode in SHORTCUTS)) SHORTCUTS[parsedKeyBinding.keyCode] = [];
      SHORTCUTS[parsedKeyBinding.keyCode].push(parsedKeyBinding);
    });
  }

  var $doc = $(document);
  var $win = $(window);

  function targetIsNotInput(event) {
    var tagName = event.target.tagName;
    return (tagName !== 'INPUT') && (tagName !== 'SELECT') && (tagName !== 'TEXTAREA');
  }

  Ember.Shortcuts = Ember.Object.extend({
    concatenatedProperties: ['filters'],

    enable: function() { ENABLED = true; },
    disable: function() { ENABLED = false; },
    filters: [targetIsNotInput],

    init: function() {
      var router = this.get('router');
      var filters = this.get('filters');

      var keyDownDispatch = makeKeyDownDispatch(router, filters);
      var keyUpDispatch = makeKeyUpDispatch(router, filters);

      $doc.on('keydown.ember-shortcuts', keyDownDispatch);
      $doc.on('keyup.ember-shortcuts', keyUpDispatch);
      $win.on('focus.ember-shortcuts', reset);
      this.enable();
    },

    router: Ember.computed(function() {
      var path = 'router:main';
      var router = Ember.getOwner
        ? Ember.getOwner(this).lookup(path)
        : this.container.lookup(path);
      return router._routerMicrolib || router.router; 
    }),

    unbind: function() {
      $doc.off('keydown.ember-shortcuts');
      $doc.off('keyup.ember-shortcuts');
      $win.off('focus.ember-shortcuts');
    },

    destroy: function() {
      SHORTCUTS = {};
      this.unbind();
    }
  });

  Ember.Route.reopen({
    mergedProperties: ['shortcuts'],
    registerShortcuts: function() {
      if (this.shortcuts && objectKeys(this.shortcuts).length) {
        register(objectKeys(this.shortcuts));
      }
    }.on('init')
  });

  Ember.onLoad('Ember.Application', function(Application) {
    Application.initializer({
      name: 'Ember Shortcuts',
      initialize: function() {
        var application = arguments[1] || arguments[0];
        application.register('shortcuts:main', Ember.Shortcuts);
        application.inject('route', 'shortcuts', 'shortcuts:main');
        application.inject('controller', 'shortcuts', 'shortcuts:main');
        application.inject('component', 'shortcuts', 'shortcuts:main');
      }
    });
  });
})(Ember, Ember.$);
