# Ember Shortcuts

## Inspiration

[keymaster](https://github.com/madrobby/keymaster). This library could not
exists without it, and is, in fact, an adaptation of it that integrates cleanly
with Ember.

## Installation

Get the code:

    bower install ember-shortcuts

Include it on your page somewhere after `ember.js`.

## Usage

In any route:

```javascript
Ember.Route.extend({
  shortcuts: {
    'shift+a': 'someAction'
  },

  actions: {
    someAction: function() {
      console.log('someAction');
    }
  }
});
```

Like `actions`, `shortcuts` get dispatch bottom-up through the currently active
routes.

Unlike `actions`, the `shortcut` handling does not bubble. In the example
above, if a child of that route defined a `shift+a: 'otherAction'` handler and
was active when the shortcut was pressed, the action `otherAction` would get
sent instead of `someAction`.

### KeyDown/KeyUp

Passing in an object rather than a string enables listening for keydown and
key up events separately.

In any route:

```javascript
Ember.Route.extend({
  shortcuts: {
    'shift+a': { keyDown: 'triggeredOnKeyDown', keyUp: 'triggeredOnKeyUp' },
  },

  actions: {
    triggeredOnKeyDown: function() {
      console.log('keyDown!');
    },
    triggeredOnKeyUp: function() {
      console.log('keyUp!');
    },
  }
});
```

## Injection

Ember.Shortcuts, once includes, is available to you as an injected singleton on
your controllers, components and routes as the `shortcuts` property.

**`this.shortcuts.disable`**
**`this.shortcuts.enable`**

Call this to toggle whether or not the global keyboard shortcut handlers will
fire.

## Filters

Before any event is triggered `this.shortcuts.filters` is checked to determine
if the event will fire. 

By default, ember-shortcuts checks the event target isn't an input, select or 
text area.

Modify `this.shortcuts.filters` to add extra filters, for example:

```javascript
function modalIsNotOpen() {
  return !Ember.$('.modal').length;
}

function targetIsNotInput(event) {
  const tagName = event.target.tagName;
  return (tagName !== 'INPUT') && (tagName !== 'SELECT') && (tagName !== 'TEXTAREA');
}

Ember.Shortcuts.reopen({
  filters: [modalIsNotOpen, targetIsNotInput]
});
```
