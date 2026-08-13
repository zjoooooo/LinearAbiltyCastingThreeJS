import { Vector2 } from 'three';
import { EventEmitter } from '../utils/EventEmitter.js';

/**
 * Normalises pointer + keyboard input into a small event vocabulary.
 *
 * Events:
 *   `pointer:move` (ndc)          — every move, armed or not
 *   `pointer:confirm` (ndc)       — left click on the viewport
 *   `action` (name, slot)         — everything else, already named by intent.
 *                                   `ability` carries the 0-based slot index,
 *                                   which App maps through `ELEMENTS`.
 *
 * Pointer events that begin on top of DOM UI (the editor, the HUD) are ignored
 * so dragging a slider never fires the ability.
 */
export class InputManager extends EventEmitter {
  constructor(domElement) {
    super();
    this.dom = domElement;
    this.pointer = new Vector2(); // NDC
    this.keys = new Set();
    this.enabled = true;

    this._bind();
  }

  _bind() {
    this.dom.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.dom.addEventListener('contextmenu', this._onContextMenu);
  }

  /**
   * A key still down when the window loses focus never delivers its keyup, so
   * the held set would keep reporting it — and the character would walk off on
   * its own the moment you tabbed away. Drop everything instead.
   */
  _onBlur = () => this.keys.clear();

  _onContextMenu = (event) => event.preventDefault();

  _updatePointer(event) {
    this.pointer.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
  }

  _onPointerDown = (event) => {
    if (!this.enabled) return;
    if (event.target !== this.dom) return; // started on UI

    this._updatePointer(event);

    if (event.button === 0) {
      this.emit('pointer:confirm', this.pointer);
    } else if (event.button === 2) {
      // Right button also orbits (OrbitControls owns the drag); putting an armed
      // cast away on the same press is the convention players expect.
      this.emit('action', 'cancel');
    }
  };

  _onPointerMove = (event) => {
    this._updatePointer(event);
    this.emit('pointer:move', this.pointer);
  };

  _onKeyDown = (event) => {
    if (event.repeat) return;
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

    this.keys.add(event.code);

    switch (event.code) {
      // Ability slots. Keep these in step with `ELEMENT_META[...].key`.
      case 'KeyQ':
      case 'Digit1':
        this.emit('action', 'ability', 0);
        break;
      case 'KeyE':
      case 'Digit2':
        this.emit('action', 'ability', 1);
        break;
      case 'KeyR':
      case 'Digit3':
        this.emit('action', 'ability', 2);
        break;
      case 'KeyF':
      case 'Digit4':
        this.emit('action', 'ability', 3);
        break;
      case 'KeyV':
      case 'Digit5':
        this.emit('action', 'ability', 4);
        break;
      case 'KeyX':
      case 'Digit6':
        this.emit('action', 'ability', 5);
        break;
      case 'Escape':
        this.emit('action', 'cancel');
        break;
      case 'KeyH':
        this.emit('action', 'toggleHelp');
        break;
      case 'KeyG':
        this.emit('action', 'toggleEditor');
        break;
      case 'KeyC':
        this.emit('action', 'clear');
        break;
      case 'KeyP':
        this.emit('action', 'togglePause');
        break;
      default:
        break;
    }
  };

  _onKeyUp = (event) => {
    this.keys.delete(event.code);
  };

  /**
   * The movement axis currently held, as state rather than an event.
   *
   * Holding a key is a condition, not something that happens once, so this is
   * polled per frame instead of being emitted through `action` — a keydown
   * fires once and repeats are dropped, which is the wrong shape for walking.
   *
   * `y` is forward and `x` is right, both -1..1, in the caller's own frame of
   * reference: this knows nothing about the camera. Diagonals are normalised so
   * running at 45° is not faster than running along an axis.
   *
   * @param {import('three').Vector2} out written in place and returned
   */
  moveAxis(out) {
    const held = (...codes) => (codes.some((code) => this.keys.has(code)) ? 1 : 0);

    out.set(
      held('KeyD', 'ArrowRight') - held('KeyA', 'ArrowLeft'),
      held('KeyW', 'ArrowUp') - held('KeyS', 'ArrowDown')
    );

    if (out.lengthSq() > 1) out.normalize();
    return out;
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.dom.removeEventListener('contextmenu', this._onContextMenu);
    this.clear();
  }
}
