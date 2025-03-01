import { Controller } from "./Controller";
import { ButtonMode, ObjectPropID } from "./FieldTypes";
import { GComponent } from "./GComponent";
import { GObject } from "./GObject";
import { GRoot } from "./GRoot";
import { GTextField } from "./GTextField";
import { PackageItem } from "./PackageItem";
import { UIConfig } from "./UIConfig";
import { UIPackage } from "./UIPackage";
import { ByteBuffer } from "../utils/ByteBuffer";
import { Window } from "./Window";
import { Timers } from "../utils/Timers";
import { Event } from "../event/Event";

export type ButtonStatus = "up" | "down" | "over" | "selectedOver" | "disabled" | "selectedDisabled";

export class GButton extends GComponent {
    protected _titleObject: GObject;
    protected _iconObject: GObject;

    private _mode: number;
    private _selected: boolean;
    private _title: string;
    private _selectedTitle: string;
    private _icon: string;
    private _selectedIcon: string;
    private _sound: string;
    private _soundVolumeScale: number = 0;
    private _buttonController: Controller;
    private _relatedController: Controller;
    private _relatedPageId: string;
    private _changeStateOnClick: boolean;
    private _linkedPopup: GObject;
    private _downEffect: number = 0;
    private _downEffectValue: number = 0;
    private _downScaled: boolean = false;

    private _down: boolean;
    private _over: boolean;

    public get down(): boolean { return this._down; }

    constructor() {
        super();

        this._mode = ButtonMode.Common;
        this._title = "";
        this._icon = "";
        this._sound = UIConfig.buttonSound;
        this._soundVolumeScale = UIConfig.buttonSoundVolumeScale;
        this._changeStateOnClick = true;
        this._downEffectValue = 0.8;
    }

    public get icon(): string {
        return this._icon;
    }

    public set icon(value: string) {
        this._icon = value;
        value = (this._selected && this._selectedIcon) ? this._selectedIcon : this._icon;
        if (this._iconObject)
            this._iconObject.icon = value;
        this.updateGear(7);
    }

    public get selectedIcon(): string {
        return this._selectedIcon;
    }

    public set selectedIcon(value: string) {
        this._selectedIcon = value;
        value = (this._selected && this._selectedIcon) ? this._selectedIcon : this._icon;
        if (this._iconObject)
            this._iconObject.icon = value;
    }

    public get title(): string {
        return this._title;
    }

    public set title(value: string) {
        this._title = value;
        if (this._titleObject)
            this._titleObject.text = (this._selected && this._selectedTitle) ? this._selectedTitle : this._title;
        this.updateGear(6);
    }

    public get text(): string {
        return this.title;
    }

    public set text(value: string) {
        this.title = value;
    }

    public get selectedTitle(): string {
        return this._selectedTitle;
    }

    public set selectedTitle(value: string) {
        this._selectedTitle = value;
        if (this._titleObject)
            this._titleObject.text = (this._selected && this._selectedTitle) ? this._selectedTitle : this._title;
    }

    public get titleColor(): number {
        var tf: GTextField = this.getTextField();
        if (tf)
            return tf.color;
        else
            return 0;
    }

    public set titleColor(value: number) {
        var tf: GTextField = this.getTextField();
        if (tf)
            tf.color = value;
        this.updateGear(4);
    }

    public get titleFontSize(): number {
        var tf: GTextField = this.getTextField();
        if (tf)
            return tf.textFormat.size;
        else
            return 0;
    }

    public set titleFontSize(value: number) {
        var tf: GTextField = this.getTextField();
        if (tf) {
            tf.textFormat.size = value;
            tf.applyFormat();
        }
    }

    public get sound(): string {
        return this._sound;
    }

    public set sound(val: string) {
        this._sound = val;
    }

    public get soundVolumeScale(): number {
        return this._soundVolumeScale;
    }

    public set soundVolumeScale(value: number) {
        this._soundVolumeScale = value;
    }

    public set selected(val: boolean) {
        if (this._mode == ButtonMode.Common)
            return;

        if (this._selected != val) {
            this._selected = val;
            this.setCurrentState();
            if (this._selectedTitle && this._titleObject)
                this._titleObject.text = this._selected ? this._selectedTitle : this._title;
            if (this._selectedIcon) {
                var str: string = this._selected ? this._selectedIcon : this._icon;
                if (this._iconObject)
                    this._iconObject.icon = str;
            }
            if (this._relatedController
                && this._parent
                && !this._parent._buildingDisplayList) {
                if (this._selected) {
                    this._relatedController.selectedPageId = this._relatedPageId;
                    if (this._relatedController.autoRadioGroupDepth)
                        this._parent.adjustRadioGroupDepth(this, this._relatedController);
                }
                else if (this._mode == ButtonMode.Check && this._relatedController.selectedPageId == this._relatedPageId)
                    this._relatedController.oppositePageId = this._relatedPageId;
            }
        }
    }

    public get selected(): boolean {
        return this._selected;
    }

    public get mode(): number {
        return this._mode;
    }

    public set mode(value: number) {
        if (this._mode != value) {
            if (value == ButtonMode.Common)
                this.selected = false;
            this._mode = value;
        }
    }

    public get relatedController(): Controller {
        return this._relatedController;
    }

    public set relatedController(val: Controller) {
        if (val != this._relatedController) {
            this._relatedController = val;
            this._relatedPageId = null;
        }
    }

    public get relatedPageId(): string {
        return this._relatedPageId;
    }

    public set relatedPageId(val: string) {
        this._relatedPageId = val;
    }

    public get changeStateOnClick(): boolean {
        return this._changeStateOnClick;
    }

    public set changeStateOnClick(value: boolean) {
        this._changeStateOnClick = value;
    }

    public get linkedPopup(): GObject {
        return this._linkedPopup;
    }

    public set linkedPopup(value: GObject) {
        this._linkedPopup = value;
    }

    public getTextField(): GTextField {
        if (this._titleObject instanceof GTextField)
            return this._titleObject;
        else if ('getTextField' in this._titleObject)
            return (<any>this._titleObject).getTextField();
        else
            return null;
    }

    public fireClick(downEffect?: boolean, clickCall?: boolean): void {
        downEffect = downEffect || false;
        if (downEffect && this._mode == ButtonMode.Common) {
            this.setState("over");
            Timers.add(100, 1, this.setState, this, "down");
            Timers.add(200, 1, this.setState, this, () => {
                this.setState("up");
                if (clickCall)
                    this.dispatchEvent("click");
            });
        }
    }

    protected setState(val: ButtonStatus): void {
        if (this._buttonController)
            this._buttonController.selectedPage = val;

        if (this._downEffect == 1) {
            var cnt: number = this.numChildren;
            if (val == "down" || val == "selectedOver" || val == "selectedDisabled") {
                var p: number = this._downEffectValue * 255;
                var r: number = (p << 16) + (p << 8) + p;
                for (var i: number = 0; i < cnt; i++) {
                    var obj: GObject = this.getChildAt(i);
                    if (!(obj instanceof GTextField))
                        obj.setProp(ObjectPropID.Color, r);
                }
            }
            else {
                for (i = 0; i < cnt; i++) {
                    obj = this.getChildAt(i);
                    if (!(obj instanceof GTextField))
                        obj.setProp(ObjectPropID.Color, 0xFFFFFF);
                }
            }
        }
        else if (this._downEffect == 2) {
            if (val == "down" || val == "selectedOver" || val == "selectedDisabled") {
                if (!this._downScaled) {
                    this.setScale(this.scaleX * this._downEffectValue, this.scaleY * this._downEffectValue);
                    this._downScaled = true;
                }
            }
            else {
                if (this._downScaled) {
                    this.setScale(this.scaleX / this._downEffectValue, this.scaleY / this._downEffectValue);
                    this._downScaled = false;
                }
            }
        }
    }

    protected setCurrentState() {
        if (this.grayed && this._buttonController && this._buttonController.hasPage("disabled")) {
            if (this._selected)
                this.setState("selectedDisabled");
            else
                this.setState("disabled");
        }
        else {
            if (this._selected)
                this.setState(this._over ? "selectedOver" : "down");
            else
                this.setState(this._over ? "over" : "up");
        }
    }

    public handleControllerChanged(c: Controller): void {
        super.handleControllerChanged(c);

        if (this._relatedController == c)
            this.selected = this._relatedPageId == c.selectedPageId;
    }

    protected handleGrayedChanged(): void {
        if (this._buttonController && this._buttonController.hasPage("disabled")) {
            if (this.grayed) {
                if (this._selected && this._buttonController.hasPage("selectedDisabled"))
                    this.setState("selectedDisabled");
                else
                    this.setState("disabled");
            }
            else if (this._selected)
                this.setState("down");
            else
                this.setState("up");
        }
        else
            super.handleGrayedChanged();
    }

    public getProp(index: number): any {
        switch (index) {
            case ObjectPropID.Color:
                return this.titleColor;
            case ObjectPropID.OutlineColor:
                {
                    var tf: GTextField = this.getTextField();
                    if (tf)
                        return tf.textFormat.outlineColor;
                    else
                        return 0;
                }
            case ObjectPropID.FontSize:
                return this.titleFontSize;
            case ObjectPropID.Selected:
                return this.selected;
            default:
                return super.getProp(index);
        }
    }

    public setProp(index: number, value: any): void {
        switch (index) {
            case ObjectPropID.Color:
                this.titleColor = value;
                break;
            case ObjectPropID.OutlineColor:
                {
                    var tf: GTextField = this.getTextField();
                    if (tf) {
                        tf.textFormat.outlineColor = value;
                        tf.applyFormat();
                    }
                }
                break;
            case ObjectPropID.FontSize:
                this.titleFontSize = value;
                break;
            case ObjectPropID.Selected:
                this.selected = value;
                break;
            default:
                super.setProp(index, value);
                break;
        }
    }

    protected constructExtension(buffer: ByteBuffer): void {
        buffer.seek(0, 6);

        this._mode = buffer.readByte();
        var str: string = buffer.readS();
        if (str)
            this._sound = str;
        this._soundVolumeScale = buffer.readFloat();
        this._downEffect = buffer.readByte();
        this._downEffectValue = buffer.readFloat();
        if (this._downEffect == 2)
            this.setPivot(0.5, 0.5, this.pivotAsAnchor);

        this._buttonController = this.getController("button");
        this._titleObject = this.getChild("title");
        this._iconObject = this.getChild("icon");
        if (this._titleObject)
            this._title = this._titleObject.text;
        if (this._iconObject)
            this._icon = this._iconObject.icon;

        if (this._mode == ButtonMode.Common)
            this.setState("up");

        this.on("roll_over", this.__rollover, this);
        this.on("roll_out", this.__rollout, this);
        this.on("touch_begin", this.__btnTouchBegin, this);
        this.on("touch_end", this.__btnTouchEnd, this);
        this.on("click", this.__click, this);
        this.on("removed_from_stage", this.__removeFromStage, this);
    }

    public setup_afterAdd(buffer: ByteBuffer, beginPos: number): void {
        super.setup_afterAdd(buffer, beginPos);

        if (!buffer.seek(beginPos, 6))
            return;

        if (buffer.readByte() != this.packageItem.objectType)
            return;

        var str: string;
        var iv: number;

        str = buffer.readS();
        if (str != null)
            this.title = str;
        str = buffer.readS();
        if (str != null)
            this.selectedTitle = str;
        str = buffer.readS();
        if (str != null)
            this.icon = str;
        str = buffer.readS();
        if (str != null)
            this.selectedIcon = str;
        if (buffer.readBool())
            this.titleColor = buffer.readColor();
        iv = buffer.readInt();
        if (iv != 0)
            this.titleFontSize = iv;
        iv = buffer.readShort();
        if (iv >= 0)
            this._relatedController = this.parent.getControllerAt(iv);
        this._relatedPageId = buffer.readS();

        str = buffer.readS();
        if (str != null)
            this._sound = str;
        if (buffer.readBool())
            this._soundVolumeScale = buffer.readFloat();

        this.selected = buffer.readBool();
    }

    private __rollover(): void {
        if (!this._buttonController || !this._buttonController.hasPage("over"))
            return;

        this._over = true;
        if (this._down)
            return;

        if (this.grayed && this._buttonController.hasPage("disabled"))
            return;

        this.setState(this._selected ? "selectedOver" : "over");
    }

    private __rollout(): void {
        if (!this._buttonController || !this._buttonController.hasPage("over"))
            return;

        this._over = false;
        if (this._down)
            return;

        if (this.grayed && this._buttonController.hasPage("disabled"))
            return;

        this.setState(this._selected ? "down" : "up");
    }

    private __btnTouchBegin(evt: Event): void {
        if (evt.input.button != 0)
            return;

        this._down = true;
        evt.captureTouch();

        if (this._mode == ButtonMode.Common) {
            if (this.grayed && this._buttonController && this._buttonController.hasPage("disabled"))
                this.setState("selectedDisabled");
            else
                this.setState("down");
        }

        if (this._linkedPopup) {
            if (this._linkedPopup instanceof Window)
                this._linkedPopup.toggleStatus();
            else
                GRoot.findFor(this).togglePopup(this._linkedPopup, this);
        }
    }

    private __btnTouchEnd(evt: Event): void {
        if (this._down) {
            this._down = false;

            if (this._mode == ButtonMode.Common) {
                if (this.grayed && this._buttonController && this._buttonController.hasPage("disabled"))
                    this.setState("disabled");
                else if (this._over)
                    this.setState("over");
                else
                    this.setState("up");
            }
            else {
                if (!this._over
                    && this._buttonController
                    && (this._buttonController.selectedPage == "over" || this._buttonController.selectedPage == "selectedOver")) {
                    this.setCurrentState();
                }
            }
        }
    }

    private __removeFromStage() {
        if (this._over)
            this.__rollout();
    }

    private __click(evt: Event): void {
        if (this._sound) {
            var pi: PackageItem = UIPackage.getItemByURL(this._sound);
            if (pi)
                GRoot.inst.playOneShotSound(pi.file);
            else
                GRoot.inst.playOneShotSound(this._sound);
        }

        if (this._mode == ButtonMode.Check) {
            if (this._changeStateOnClick) {
                this.selected = !this._selected;
                this.dispatchEvent("status_changed");
            }
        }
        else if (this._mode == ButtonMode.Radio) {
            if (this._changeStateOnClick && !this._selected) {
                this.selected = true;
                this.dispatchEvent("status_changed");
            }
        }
        else {
            if (this._relatedController)
                this._relatedController.selectedPageId = this._relatedPageId;
        }
    }
}
