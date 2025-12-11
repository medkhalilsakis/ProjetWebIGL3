import {
  config$1,
  counter,
  dom$1,
  icon,
  parse$1,
  text
} from "./chunk-YQIO4DSX.js";
import {
  DomSanitizer
} from "./chunk-YHQK4P5W.js";
import "./chunk-CIF7II3Z.js";
import "./chunk-NHIWDWPK.js";
import "./chunk-BV6YITCM.js";
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  Directive,
  Injectable,
  NgModule,
  computed,
  effect,
  inject,
  input,
  model,
  setClassMetadata,
  ɵɵInheritDefinitionFeature,
  ɵɵattribute,
  ɵɵclassMap,
  ɵɵdefineComponent,
  ɵɵdefineDirective,
  ɵɵdefineInjectable,
  ɵɵdefineInjector,
  ɵɵdefineNgModule,
  ɵɵdomProperty,
  ɵɵgetInheritedFactory,
  ɵɵprojection,
  ɵɵprojectionDef,
  ɵɵsanitizeHtml
} from "./chunk-SQEATRU6.js";
import "./chunk-JRFR6BLO.js";
import "./chunk-HWYXSU2G.js";
import "./chunk-MARUHEWW.js";
import {
  __spreadProps,
  __spreadValues
} from "./chunk-3OV72XIM.js";

// node_modules/@fortawesome/angular-fontawesome/fesm2022/angular-fontawesome.mjs
var _c0 = ["*"];
var FaConfig = class _FaConfig {
  /**
   * Default prefix to use, when one is not provided with the icon name.
   *
   * @default 'fas'
   */
  defaultPrefix = "fas";
  /**
   * Provides a fallback icon to use whilst main icon is being loaded asynchronously.
   * When value is null, then fa-icon component will throw an error if icon input is missing.
   * When value is not null, then the provided icon will be used as a fallback icon if icon input is missing.
   *
   * @default null
   */
  fallbackIcon = null;
  /**
   * Set icons to the same fixed width.
   *
   * @see {@link: https://fontawesome.com/how-to-use/on-the-web/styling/fixed-width-icons}
   * @default false
   */
  fixedWidth;
  /**
   * Automatically add Font Awesome styles to the document when icon is rendered.
   *
   * For the majority of the cases the automatically added CSS is sufficient,
   * please refer to the linked guide for more information on when to disable
   * this feature.
   *
   * @see {@link: https://github.com/FortAwesome/angular-fontawesome/blob/main/docs/guide/adding-css.md}
   * @default true
   */
  set autoAddCss(value) {
    config$1.autoAddCss = value;
    this._autoAddCss = value;
  }
  get autoAddCss() {
    return this._autoAddCss;
  }
  _autoAddCss = true;
  static ɵfac = function FaConfig_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _FaConfig)();
  };
  static ɵprov = ɵɵdefineInjectable({
    token: _FaConfig,
    factory: _FaConfig.ɵfac,
    providedIn: "root"
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FaConfig, [{
    type: Injectable,
    args: [{
      providedIn: "root"
    }]
  }], null, null);
})();
var FaIconLibrary = class _FaIconLibrary {
  definitions = {};
  addIcons(...icons) {
    for (const icon2 of icons) {
      if (!(icon2.prefix in this.definitions)) {
        this.definitions[icon2.prefix] = {};
      }
      this.definitions[icon2.prefix][icon2.iconName] = icon2;
      for (const alias of icon2.icon[2]) {
        if (typeof alias === "string") {
          this.definitions[icon2.prefix][alias] = icon2;
        }
      }
    }
  }
  addIconPacks(...packs) {
    for (const pack of packs) {
      const icons = Object.keys(pack).map((key) => pack[key]);
      this.addIcons(...icons);
    }
  }
  getIconDefinition(prefix, name) {
    if (prefix in this.definitions && name in this.definitions[prefix]) {
      return this.definitions[prefix][name];
    }
    return null;
  }
  static ɵfac = function FaIconLibrary_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _FaIconLibrary)();
  };
  static ɵprov = ɵɵdefineInjectable({
    token: _FaIconLibrary,
    factory: _FaIconLibrary.ɵfac,
    providedIn: "root"
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FaIconLibrary, [{
    type: Injectable,
    args: [{
      providedIn: "root"
    }]
  }], null, null);
})();
var faWarnIfIconDefinitionMissing = (iconSpec) => {
  throw new Error(`Could not find icon with iconName=${iconSpec.iconName} and prefix=${iconSpec.prefix} in the icon library.`);
};
var faWarnIfIconSpecMissing = () => {
  throw new Error("Property `icon` is required for `fa-icon`/`fa-duotone-icon` components.");
};
var isKnownRotateValue = (rotate) => rotate != null && (rotate === 90 || rotate === 180 || rotate === 270 || rotate === "90" || rotate === "180" || rotate === "270");
var faClassList = (props) => {
  const knownRotateValue = isKnownRotateValue(props.rotate);
  const classes = {
    [`fa-${props.animation}`]: props.animation != null && !props.animation.startsWith("spin"),
    "fa-spin": props.animation === "spin" || props.animation === "spin-reverse",
    "fa-spin-pulse": props.animation === "spin-pulse" || props.animation === "spin-pulse-reverse",
    "fa-spin-reverse": props.animation === "spin-reverse" || props.animation === "spin-pulse-reverse",
    // According to https://fontawesome.com/docs/web/style/animate#spin fa-pulse
    // class is deprecated, remove the below line when Font Awesome 5 support
    // is dropped.
    "fa-pulse": props.animation === "spin-pulse" || props.animation === "spin-pulse-reverse",
    "fa-fw": props.fixedWidth,
    "fa-border": props.border,
    "fa-inverse": props.inverse,
    "fa-layers-counter": props.counter,
    "fa-flip-horizontal": props.flip === "horizontal" || props.flip === "both",
    "fa-flip-vertical": props.flip === "vertical" || props.flip === "both",
    [`fa-${props.size}`]: props.size !== null,
    [`fa-rotate-${props.rotate}`]: knownRotateValue,
    "fa-rotate-by": props.rotate != null && !knownRotateValue,
    [`fa-pull-${props.pull}`]: props.pull !== null,
    [`fa-stack-${props.stackItemSize}`]: props.stackItemSize != null
  };
  return Object.keys(classes).map((key) => classes[key] ? key : null).filter((key) => key != null);
};
var cssInserted = /* @__PURE__ */ new WeakSet();
var autoCssId = "fa-auto-css";
function ensureCss(document, config) {
  if (!config.autoAddCss) {
    return;
  }
  if (cssInserted.has(document)) {
    return;
  }
  if (document.getElementById(autoCssId) != null) {
    config.autoAddCss = false;
    cssInserted.add(document);
    return;
  }
  const style = document.createElement("style");
  style.setAttribute("type", "text/css");
  style.setAttribute("id", autoCssId);
  style.innerHTML = dom$1.css();
  const headChildren = document.head.childNodes;
  let beforeChild = null;
  for (let i = headChildren.length - 1; i > -1; i--) {
    const child = headChildren[i];
    const tagName = child.nodeName.toUpperCase();
    if (["STYLE", "LINK"].indexOf(tagName) > -1) {
      beforeChild = child;
    }
  }
  document.head.insertBefore(style, beforeChild);
  config.autoAddCss = false;
  cssInserted.add(document);
}
var isIconLookup = (i) => i.prefix !== void 0 && i.iconName !== void 0;
var faNormalizeIconSpec = (iconSpec, defaultPrefix) => {
  if (isIconLookup(iconSpec)) {
    return iconSpec;
  }
  if (Array.isArray(iconSpec) && iconSpec.length === 2) {
    return {
      prefix: iconSpec[0],
      iconName: iconSpec[1]
    };
  }
  return {
    prefix: defaultPrefix,
    iconName: iconSpec
  };
};
var FaStackItemSizeDirective = class _FaStackItemSizeDirective {
  /**
   * Specify whether icon inside {@link FaStackComponent} should be rendered in
   * regular size (1x) or as a larger icon (2x).
   */
  stackItemSize = input("1x");
  /**
   * @internal
   */
  size = input();
  _effect = effect(() => {
    const size = this.size();
    if (size) {
      throw new Error('fa-icon is not allowed to customize size when used inside fa-stack. Set size on the enclosing fa-stack instead: <fa-stack size="4x">...</fa-stack>.');
    }
  });
  static ɵfac = function FaStackItemSizeDirective_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _FaStackItemSizeDirective)();
  };
  static ɵdir = ɵɵdefineDirective({
    type: _FaStackItemSizeDirective,
    selectors: [["fa-icon", "stackItemSize", ""], ["fa-duotone-icon", "stackItemSize", ""]],
    inputs: {
      stackItemSize: [1, "stackItemSize"],
      size: [1, "size"]
    }
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FaStackItemSizeDirective, [{
    type: Directive,
    args: [{
      // eslint-disable-next-line @angular-eslint/directive-selector
      selector: "fa-icon[stackItemSize],fa-duotone-icon[stackItemSize]"
    }]
  }], null, null);
})();
var FaStackComponent = class _FaStackComponent {
  /**
   * Size of the stacked icon.
   * Note that stacked icon is by default 2 times bigger, than non-stacked icon.
   * You'll need to set size using custom CSS to align stacked icon with a
   * simple one. E.g. `fa-stack { font-size: 0.5em; }`.
   */
  size = input();
  classes = computed(() => {
    const sizeValue = this.size();
    const sizeClass = sizeValue ? {
      [`fa-${sizeValue}`]: true
    } : {};
    return __spreadProps(__spreadValues({}, sizeClass), {
      "fa-stack": true
    });
  });
  static ɵfac = function FaStackComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _FaStackComponent)();
  };
  static ɵcmp = ɵɵdefineComponent({
    type: _FaStackComponent,
    selectors: [["fa-stack"]],
    hostVars: 2,
    hostBindings: function FaStackComponent_HostBindings(rf, ctx) {
      if (rf & 2) {
        ɵɵclassMap(ctx.classes());
      }
    },
    inputs: {
      size: [1, "size"]
    },
    ngContentSelectors: _c0,
    decls: 1,
    vars: 0,
    template: function FaStackComponent_Template(rf, ctx) {
      if (rf & 1) {
        ɵɵprojectionDef();
        ɵɵprojection(0);
      }
    },
    encapsulation: 2,
    changeDetection: 0
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FaStackComponent, [{
    type: Component,
    args: [{
      selector: "fa-stack",
      template: `<ng-content />`,
      host: {
        "[class]": "classes()"
      },
      changeDetection: ChangeDetectionStrategy.OnPush
    }]
  }], null, null);
})();
var FaIconComponent = class _FaIconComponent {
  icon = model();
  /**
   * Specify a title for the icon.
   *
   * This text will be displayed in a tooltip on hover and presented to the
   * screen readers.
   */
  title = model();
  /**
   * Icon animation.
   *
   * Most of the animations are only available when using Font Awesome 6. With
   * Font Awesome 5, only 'spin' and 'spin-pulse' are supported.
   */
  animation = model();
  mask = model();
  flip = model();
  size = model();
  pull = model();
  border = model();
  inverse = model();
  symbol = model();
  rotate = model();
  fixedWidth = model();
  transform = model();
  /**
   * Specify the `role` attribute for the rendered <svg> element.
   *
   * @default 'img'
   */
  a11yRole = model();
  renderedIconHTML = computed(() => {
    const iconValue = this.icon() ?? this.config.fallbackIcon;
    if (!iconValue) {
      faWarnIfIconSpecMissing();
      return "";
    }
    const iconDefinition = this.findIconDefinition(iconValue);
    if (!iconDefinition) {
      return "";
    }
    const params = this.buildParams();
    ensureCss(this.document, this.config);
    const renderedIcon = icon(iconDefinition, params);
    return this.sanitizer.bypassSecurityTrustHtml(renderedIcon.html.join("\n"));
  });
  document = inject(DOCUMENT);
  sanitizer = inject(DomSanitizer);
  config = inject(FaConfig);
  iconLibrary = inject(FaIconLibrary);
  stackItem = inject(FaStackItemSizeDirective, {
    optional: true
  });
  stack = inject(FaStackComponent, {
    optional: true
  });
  constructor() {
    if (this.stack != null && this.stackItem == null) {
      console.error('FontAwesome: fa-icon and fa-duotone-icon elements must specify stackItemSize attribute when wrapped into fa-stack. Example: <fa-icon stackItemSize="2x" />.');
    }
  }
  findIconDefinition(i) {
    const lookup = faNormalizeIconSpec(i, this.config.defaultPrefix);
    if ("icon" in lookup) {
      return lookup;
    }
    const definition = this.iconLibrary.getIconDefinition(lookup.prefix, lookup.iconName);
    if (definition != null) {
      return definition;
    }
    faWarnIfIconDefinitionMissing(lookup);
    return null;
  }
  buildParams() {
    const fixedWidth = this.fixedWidth();
    const classOpts = {
      flip: this.flip(),
      animation: this.animation(),
      border: this.border(),
      inverse: this.inverse(),
      size: this.size(),
      pull: this.pull(),
      rotate: this.rotate(),
      fixedWidth: typeof fixedWidth === "boolean" ? fixedWidth : this.config.fixedWidth,
      stackItemSize: this.stackItem != null ? this.stackItem.stackItemSize() : void 0
    };
    const transform = this.transform();
    const parsedTransform = typeof transform === "string" ? parse$1.transform(transform) : transform;
    const mask = this.mask();
    const maskIconDefinition = mask != null ? this.findIconDefinition(mask) : null;
    const attributes = {};
    const a11yRole = this.a11yRole();
    if (a11yRole != null) {
      attributes["role"] = a11yRole;
    }
    const styles = {};
    if (classOpts.rotate != null && !isKnownRotateValue(classOpts.rotate)) {
      styles["--fa-rotate-angle"] = `${classOpts.rotate}`;
    }
    return {
      title: this.title(),
      transform: parsedTransform,
      classes: faClassList(classOpts),
      mask: maskIconDefinition ?? void 0,
      symbol: this.symbol(),
      attributes,
      styles
    };
  }
  static ɵfac = function FaIconComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _FaIconComponent)();
  };
  static ɵcmp = ɵɵdefineComponent({
    type: _FaIconComponent,
    selectors: [["fa-icon"]],
    hostAttrs: [1, "ng-fa-icon"],
    hostVars: 2,
    hostBindings: function FaIconComponent_HostBindings(rf, ctx) {
      if (rf & 2) {
        ɵɵdomProperty("innerHTML", ctx.renderedIconHTML(), ɵɵsanitizeHtml);
        ɵɵattribute("title", ctx.title() ?? void 0);
      }
    },
    inputs: {
      icon: [1, "icon"],
      title: [1, "title"],
      animation: [1, "animation"],
      mask: [1, "mask"],
      flip: [1, "flip"],
      size: [1, "size"],
      pull: [1, "pull"],
      border: [1, "border"],
      inverse: [1, "inverse"],
      symbol: [1, "symbol"],
      rotate: [1, "rotate"],
      fixedWidth: [1, "fixedWidth"],
      transform: [1, "transform"],
      a11yRole: [1, "a11yRole"]
    },
    outputs: {
      icon: "iconChange",
      title: "titleChange",
      animation: "animationChange",
      mask: "maskChange",
      flip: "flipChange",
      size: "sizeChange",
      pull: "pullChange",
      border: "borderChange",
      inverse: "inverseChange",
      symbol: "symbolChange",
      rotate: "rotateChange",
      fixedWidth: "fixedWidthChange",
      transform: "transformChange",
      a11yRole: "a11yRoleChange"
    },
    decls: 0,
    vars: 0,
    template: function FaIconComponent_Template(rf, ctx) {
    },
    encapsulation: 2,
    changeDetection: 0
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FaIconComponent, [{
    type: Component,
    args: [{
      selector: "fa-icon",
      template: ``,
      host: {
        class: "ng-fa-icon",
        "[attr.title]": "title() ?? undefined",
        "[innerHTML]": "renderedIconHTML()"
      },
      changeDetection: ChangeDetectionStrategy.OnPush
    }]
  }], () => [], null);
})();
var FaDuotoneIconComponent = class _FaDuotoneIconComponent extends FaIconComponent {
  /**
   * Swap the default opacity of each duotone icon’s layers. This will make an
   * icon’s primary layer have the default opacity of 40% rather than its
   * secondary layer.
   *
   * @default false
   */
  swapOpacity = input();
  /**
   * Customize the opacity of the primary icon layer.
   * Valid values are in range [0, 1.0].
   *
   * @default 1.0
   */
  primaryOpacity = input();
  /**
   * Customize the opacity of the secondary icon layer.
   * Valid values are in range [0, 1.0].
   *
   * @default 0.4
   */
  secondaryOpacity = input();
  /**
   * Customize the color of the primary icon layer.
   * Accepts any valid CSS color value.
   *
   * @default CSS inherited color
   */
  primaryColor = input();
  /**
   * Customize the color of the secondary icon layer.
   * Accepts any valid CSS color value.
   *
   * @default CSS inherited color
   */
  secondaryColor = input();
  findIconDefinition(i) {
    const definition = super.findIconDefinition(i);
    if (definition != null && !Array.isArray(definition.icon[4])) {
      throw new Error(`The specified icon does not appear to be a Duotone icon. Check that you specified the correct style: <fa-duotone-icon [icon]="['fad', '${definition.iconName}']" /> or use: <fa-icon icon="${definition.iconName}" /> instead.`);
    }
    return definition;
  }
  buildParams() {
    const params = super.buildParams();
    const swapOpacity = this.swapOpacity();
    if (swapOpacity === true || swapOpacity === "true") {
      if (Array.isArray(params.classes)) {
        params.classes.push("fa-swap-opacity");
      } else if (typeof params.classes === "string") {
        params.classes = [params.classes, "fa-swap-opacity"];
      } else {
        params.classes = ["fa-swap-opacity"];
      }
    }
    if (params.styles == null) {
      params.styles = {};
    }
    const primaryOpacity = this.primaryOpacity();
    if (primaryOpacity != null) {
      params.styles["--fa-primary-opacity"] = primaryOpacity.toString();
    }
    const secondaryOpacity = this.secondaryOpacity();
    if (secondaryOpacity != null) {
      params.styles["--fa-secondary-opacity"] = secondaryOpacity.toString();
    }
    const primaryColor = this.primaryColor();
    if (primaryColor != null) {
      params.styles["--fa-primary-color"] = primaryColor;
    }
    const secondaryColor = this.secondaryColor();
    if (secondaryColor != null) {
      params.styles["--fa-secondary-color"] = secondaryColor;
    }
    return params;
  }
  static ɵfac = /* @__PURE__ */ (() => {
    let ɵFaDuotoneIconComponent_BaseFactory;
    return function FaDuotoneIconComponent_Factory(__ngFactoryType__) {
      return (ɵFaDuotoneIconComponent_BaseFactory || (ɵFaDuotoneIconComponent_BaseFactory = ɵɵgetInheritedFactory(_FaDuotoneIconComponent)))(__ngFactoryType__ || _FaDuotoneIconComponent);
    };
  })();
  static ɵcmp = ɵɵdefineComponent({
    type: _FaDuotoneIconComponent,
    selectors: [["fa-duotone-icon"]],
    inputs: {
      swapOpacity: [1, "swapOpacity"],
      primaryOpacity: [1, "primaryOpacity"],
      secondaryOpacity: [1, "secondaryOpacity"],
      primaryColor: [1, "primaryColor"],
      secondaryColor: [1, "secondaryColor"]
    },
    features: [ɵɵInheritDefinitionFeature],
    decls: 0,
    vars: 0,
    template: function FaDuotoneIconComponent_Template(rf, ctx) {
    },
    encapsulation: 2,
    changeDetection: 0
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FaDuotoneIconComponent, [{
    type: Component,
    args: [{
      selector: "fa-duotone-icon",
      template: ``,
      changeDetection: ChangeDetectionStrategy.OnPush
    }]
  }], null, null);
})();
var faWarnIfParentNotExist = (parent, parentName, childName) => {
  if (!parent) {
    throw new Error(`${childName} should be used as child of ${parentName} only.`);
  }
};
var FaLayersComponent = class _FaLayersComponent {
  size = input();
  fixedWidth = input();
  faFw = computed(() => {
    const fixedWidth = this.fixedWidth();
    return typeof fixedWidth === "boolean" ? fixedWidth : this.config.fixedWidth;
  });
  classes = computed(() => {
    const sizeValue = this.size();
    const sizeClass = sizeValue ? {
      [`fa-${sizeValue}`]: true
    } : {};
    return __spreadProps(__spreadValues({}, sizeClass), {
      "fa-fw": this.faFw(),
      "fa-layers": true
    });
  });
  document = inject(DOCUMENT);
  config = inject(FaConfig);
  ngOnInit() {
    ensureCss(this.document, this.config);
  }
  static ɵfac = function FaLayersComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _FaLayersComponent)();
  };
  static ɵcmp = ɵɵdefineComponent({
    type: _FaLayersComponent,
    selectors: [["fa-layers"]],
    hostVars: 2,
    hostBindings: function FaLayersComponent_HostBindings(rf, ctx) {
      if (rf & 2) {
        ɵɵclassMap(ctx.classes());
      }
    },
    inputs: {
      size: [1, "size"],
      fixedWidth: [1, "fixedWidth"]
    },
    ngContentSelectors: _c0,
    decls: 1,
    vars: 0,
    template: function FaLayersComponent_Template(rf, ctx) {
      if (rf & 1) {
        ɵɵprojectionDef();
        ɵɵprojection(0);
      }
    },
    encapsulation: 2,
    changeDetection: 0
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FaLayersComponent, [{
    type: Component,
    args: [{
      selector: "fa-layers",
      template: `<ng-content />`,
      host: {
        "[class]": "classes()"
      },
      changeDetection: ChangeDetectionStrategy.OnPush
    }]
  }], null, null);
})();
var FaLayersCounterComponent = class _FaLayersCounterComponent {
  content = input.required();
  title = input();
  position = input();
  renderedHTML = computed(() => {
    const params = this.buildParams();
    return this.updateContent(params);
  });
  document = inject(DOCUMENT);
  config = inject(FaConfig);
  parent = inject(FaLayersComponent, {
    optional: true
  });
  sanitizer = inject(DomSanitizer);
  constructor() {
    faWarnIfParentNotExist(this.parent, "FaLayersComponent", this.constructor.name);
  }
  buildParams() {
    const position = this.position();
    return {
      title: this.title(),
      classes: position != null ? [`fa-layers-${position}`] : void 0
    };
  }
  updateContent(params) {
    ensureCss(this.document, this.config);
    return this.sanitizer.bypassSecurityTrustHtml(counter(this.content() || "", params).html.join(""));
  }
  static ɵfac = function FaLayersCounterComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _FaLayersCounterComponent)();
  };
  static ɵcmp = ɵɵdefineComponent({
    type: _FaLayersCounterComponent,
    selectors: [["fa-layers-counter"]],
    hostAttrs: [1, "ng-fa-layers-counter"],
    hostVars: 1,
    hostBindings: function FaLayersCounterComponent_HostBindings(rf, ctx) {
      if (rf & 2) {
        ɵɵdomProperty("innerHTML", ctx.renderedHTML(), ɵɵsanitizeHtml);
      }
    },
    inputs: {
      content: [1, "content"],
      title: [1, "title"],
      position: [1, "position"]
    },
    decls: 0,
    vars: 0,
    template: function FaLayersCounterComponent_Template(rf, ctx) {
    },
    encapsulation: 2,
    changeDetection: 0
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FaLayersCounterComponent, [{
    type: Component,
    args: [{
      selector: "fa-layers-counter",
      template: "",
      host: {
        class: "ng-fa-layers-counter",
        "[innerHTML]": "renderedHTML()"
      },
      changeDetection: ChangeDetectionStrategy.OnPush
    }]
  }], () => [], null);
})();
var FaLayersTextComponent = class _FaLayersTextComponent {
  content = input.required();
  title = input();
  flip = input();
  size = input();
  pull = input();
  border = input();
  inverse = input();
  rotate = input();
  fixedWidth = input();
  transform = input();
  renderedHTML = computed(() => {
    const params = this.buildParams();
    return this.updateContent(params);
  });
  document = inject(DOCUMENT);
  config = inject(FaConfig);
  parent = inject(FaLayersComponent, {
    optional: true
  });
  sanitizer = inject(DomSanitizer);
  constructor() {
    faWarnIfParentNotExist(this.parent, "FaLayersComponent", this.constructor.name);
  }
  /**
   * Updating params by component props.
   */
  buildParams() {
    const classOpts = {
      flip: this.flip(),
      border: this.border(),
      inverse: this.inverse(),
      size: this.size(),
      pull: this.pull(),
      rotate: this.rotate(),
      fixedWidth: this.fixedWidth()
    };
    const transform = this.transform();
    const parsedTransform = typeof transform === "string" ? parse$1.transform(transform) : transform;
    const styles = {};
    if (classOpts.rotate != null && !isKnownRotateValue(classOpts.rotate)) {
      styles["--fa-rotate-angle"] = `${classOpts.rotate}`;
    }
    return {
      transform: parsedTransform,
      classes: faClassList(classOpts),
      title: this.title(),
      styles
    };
  }
  updateContent(params) {
    ensureCss(this.document, this.config);
    return this.sanitizer.bypassSecurityTrustHtml(text(this.content() || "", params).html.join("\n"));
  }
  static ɵfac = function FaLayersTextComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _FaLayersTextComponent)();
  };
  static ɵcmp = ɵɵdefineComponent({
    type: _FaLayersTextComponent,
    selectors: [["fa-layers-text"]],
    hostAttrs: [1, "ng-fa-layers-text"],
    hostVars: 1,
    hostBindings: function FaLayersTextComponent_HostBindings(rf, ctx) {
      if (rf & 2) {
        ɵɵdomProperty("innerHTML", ctx.renderedHTML(), ɵɵsanitizeHtml);
      }
    },
    inputs: {
      content: [1, "content"],
      title: [1, "title"],
      flip: [1, "flip"],
      size: [1, "size"],
      pull: [1, "pull"],
      border: [1, "border"],
      inverse: [1, "inverse"],
      rotate: [1, "rotate"],
      fixedWidth: [1, "fixedWidth"],
      transform: [1, "transform"]
    },
    decls: 0,
    vars: 0,
    template: function FaLayersTextComponent_Template(rf, ctx) {
    },
    encapsulation: 2,
    changeDetection: 0
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FaLayersTextComponent, [{
    type: Component,
    args: [{
      selector: "fa-layers-text",
      template: "",
      host: {
        class: "ng-fa-layers-text",
        "[innerHTML]": "renderedHTML()"
      },
      changeDetection: ChangeDetectionStrategy.OnPush
    }]
  }], () => [], null);
})();
var FontAwesomeModule = class _FontAwesomeModule {
  static ɵfac = function FontAwesomeModule_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _FontAwesomeModule)();
  };
  static ɵmod = ɵɵdefineNgModule({
    type: _FontAwesomeModule,
    imports: [FaIconComponent, FaDuotoneIconComponent, FaLayersComponent, FaLayersTextComponent, FaLayersCounterComponent, FaStackComponent, FaStackItemSizeDirective],
    exports: [FaIconComponent, FaDuotoneIconComponent, FaLayersComponent, FaLayersTextComponent, FaLayersCounterComponent, FaStackComponent, FaStackItemSizeDirective]
  });
  static ɵinj = ɵɵdefineInjector({});
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FontAwesomeModule, [{
    type: NgModule,
    args: [{
      imports: [FaIconComponent, FaDuotoneIconComponent, FaLayersComponent, FaLayersTextComponent, FaLayersCounterComponent, FaStackComponent, FaStackItemSizeDirective],
      exports: [FaIconComponent, FaDuotoneIconComponent, FaLayersComponent, FaLayersTextComponent, FaLayersCounterComponent, FaStackComponent, FaStackItemSizeDirective]
    }]
  }], null, null);
})();
export {
  FaConfig,
  FaDuotoneIconComponent,
  FaIconComponent,
  FaIconLibrary,
  FaLayersComponent,
  FaLayersCounterComponent,
  FaLayersTextComponent,
  FaStackComponent,
  FaStackItemSizeDirective,
  FontAwesomeModule
};
//# sourceMappingURL=@fortawesome_angular-fontawesome.js.map
