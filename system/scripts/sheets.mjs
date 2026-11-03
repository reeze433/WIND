import {modeViews,editActionMode,deleteActionMode} from './item-modes.mjs';
import {bindItemTooltips} from './item-tooltips.mjs';
import {panelGridLimit,panelOrder,usesCardGrid} from './card-defaults.mjs';
import {GRID_CATEGORIES,layoutCards,gridViewportGeometry} from './card-grid.mjs';
import {bindCardGrids,toggleGridCard,resizeGridItem,fitCardGrid} from './card-grid-ui.mjs';
import {chargeMaximum,chargeFormulaError} from './charge-formula.mjs';
import {attributePool} from './branches.mjs';
import {effectPresentation} from './effect-presentation.mjs';
import {itemAvailability} from './item-availability.mjs';
import {spendInspiration} from './resources.mjs';
import {resourceDefinitions,customResourceViews,setCustomResourceValue,configureCustomResource} from './custom-resources.mjs';
import {itemEffectViews} from './item-effects.mjs';
import {transferCurrency} from './currency.mjs';
import {validateChargeSource,validateChargeReceiver} from './charges.mjs';
import {itemEditorText,itemTextHTML} from './item-text.mjs';
import {conditionViews,openCondition} from './conditions.mjs';
import {ATTRIBUTES} from "./dice.mjs";
import {t, escape, rollAttribute} from "./rolls.mjs";
import {rollItem} from "./items.mjs";
import {rollCoin} from "./coin.mjs";
import {currencyTypes} from "./presentation.mjs";
import {TIERS, tierModifier} from "./tiers.mjs";
import {CATEGORIES,categoryOf,orderCards,categoryLabel,indexCards} from './cards.mjs';
const {HandlebarsApplicationMixin} = foundry.applications.api;
const {ActorSheetV2, ItemSheetV2} = foundry.applications.sheets;
export class VitruviyActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["vitruviy", "vit-actor"], position: {width: 1040, height: 820},
    window: {resizable: true}, form: {submitOnChange: true, closeOnSubmit: false},
    actions: {togglePanel:this.onTogglePanel,movePanel:this.onMovePanel,toggleGridCard:this.onToggleGridCard,togglePrepared:this.onTogglePrepared,configureResource:this.onConfigureResource,toggleEffect:this.onToggleEffect,deleteEffect:this.onDeleteEffect,transferCurrency:this.onTransferCurrency,sheetTab:this.onSheetTab,openStatus:this.onOpenStatus,removeStatus:this.onRemoveStatus,toggleEdit:this.onToggleEdit,filterCards:this.onFilter,coin: this.onCoin, roll: this.onRoll,rollBranch:this.onRollBranch, rollItem: this.onItemRoll, toggleCards: this.onToggleCards, createCard: this.onCreate, editCard: this.onEdit, deleteCard: this.onDelete, publishCard: this.onPublish, tokenizer: this.onTokenizer, resource: this.onResource}
  };
  static PARTS = {body: {template: "systems/vitruviy/templates/actor.hbs", scrollable: [".vit-tab-content"]}};
  async _processSubmitData(event,form,data,options={}){
    const value=data.system?.inspiration?.value??data["system.inspiration.value"];
    return super._processSubmitData(event,form,data,{...options,...(value!==undefined&&Number(value)!==this.actor.system.inspiration.value?{vitruviyInspirationEdit:true}:{})});
  }
  async _onRender(context, options) {
    await super._onRender(context, options);
    for(const input of this.element.querySelectorAll('.vit-currencies input')){
      const fit=()=>input.style.setProperty('--vit-currency-width',`${Math.max(4,String(input.value).length+2)}ch`);
      fit();input.addEventListener('input',fit);
    }
    for(const slider of this.element.querySelectorAll('.vit-card-scale:not(.vit-card-text-scale) input')){
      const update=()=>{
        const scale=Math.min(1.5,Math.max(.6,Number(slider.value)/100));
        const section=slider.closest('[data-card-scale]');section.style.setProperty('--vit-card-scale',String(scale));section.dataset.cardScale=String(scale);
        const board=section.querySelector('.wind-grid');if(board)fitCardGrid(this,board);
        slider.closest('label').querySelector('output').value=`${Math.round(scale*100)}%`;
        return scale;
      };
      slider.addEventListener('input',event=>{event.stopPropagation();update();});
      slider.addEventListener('change',event=>{
        event.stopPropagation();const scale=update(),key=this.actor.uuid.replace(/\W/g,'_');
        game.user.setFlag('vitruviy',`cardScales.${key}.${slider.dataset.type}`,scale).catch(error=>ui.notifications.error(error.message));
      });
    }
    for(const slider of this.element.querySelectorAll('.vit-card-text-scale input')){
      const update=()=>{const scale=Math.min(1.5,Math.max(.6,Number(slider.value)/100));
        slider.closest('[data-card-scale]').style.setProperty('--vit-card-text-scale',String(scale));
        slider.closest('label').querySelector('output').value=`${Math.round(scale*100)}%`;return scale;};
      slider.addEventListener('input',event=>{event.stopPropagation();update();});
      slider.addEventListener('change',event=>{event.stopPropagation();const scale=update(),key=this.actor.uuid.replace(/\W/g,'_');
        game.user.setFlag('vitruviy',`cardTextScales.${key}.${slider.dataset.type}`,scale).catch(error=>ui.notifications.error(error.message));});
    }
    for(const input of this.element.querySelectorAll('.vit-custom-resource input')){
      input.addEventListener('change',async event=>{
        event.stopPropagation();
        try{await setCustomResourceValue(this.actor,input.dataset.resourceId,Number(input.value));}
        catch(error){ui.notifications.error(error.message);input.value=customResourceViews(this.actor).find(entry=>entry.id===input.dataset.resourceId)?.value??0;}
      });
    }
    bindCardGrids(this);
    bindItemTooltips(this);
    this._headerResizeObserver?.disconnect();
    const body = this.element.querySelector('.vit-tab-content');
    this.element.querySelector('.vit-side-tabs')?.addEventListener('keydown',event=>{
      const tabs=[...this.element.querySelectorAll('.vit-side-tabs [role="tab"]')];
      const index=tabs.indexOf(event.target);if(index<0)return;
      const next={ArrowDown:(index+1)%tabs.length,ArrowUp:(index+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[event.key];
      if(next===undefined)return;event.preventDefault();this._selectSheetTab(tabs[next].dataset.tab);tabs[next].focus();
    });
    if (body) {
      const alignHeader = () => {
        const gap = `${Math.max(0, body.offsetWidth - body.clientWidth)}px`;
        if (this.element.style.getPropertyValue('--vit-scrollbar-gap') !== gap) this.element.style.setProperty('--vit-scrollbar-gap', gap);
      };
      alignHeader();
      this._headerResizeObserver = new ResizeObserver(alignHeader);
      this._headerResizeObserver.observe(body);
    }
    const header = this.element.querySelector('.window-header');
    if (!header) return;
    let toggle = header.querySelector('.vit-title-edit');
    if (!context.editable || context.limited) {toggle?.remove(); return;}
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'vit-edit-toggle vit-title-edit';
      toggle.dataset.action = 'toggleEdit';
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-label', t('EditValues'));
      toggle.title = t('EditValues');
      toggle.innerHTML = '<i class="fa-solid fa-pen" aria-hidden="true"></i><span class="vit-toggle-track" aria-hidden="true"></span>';
      header.prepend(toggle);
    }
    toggle.setAttribute('aria-checked', String(context.editValues));
  }
  _onClose(options) {
    this._windTooltipCleanup?.();
    this._windGridObserver?.disconnect();
    this._headerResizeObserver?.disconnect();
    super._onClose(options);
  }
  _canRender(options) {
    if (this.actor.type === "character" && !this.actor.testUserPermission(game.user, "OWNER")) throw new Error(t("NoPermission"));
    return super._canRender(options);
  }
  async _prepareContext(options) {
    const c = await super._prepareContext(options);
    const limited = !this.actor.testUserPermission(game.user, "OBSERVER");
    const viewKey = this.actor.uuid.replace(/\W/g, "_");
    const panels=panelOrder(game.user.getFlag('vitruviy','panelOrder')?.[viewKey]);
    const panelClosed=game.user.getFlag('vitruviy','panelClosed')?.[viewKey]??[];
    const collapsed = game.user.getFlag("vitruviy", "cardViews")?.[viewKey] ?? [];
    const sorting=game.user.getFlag('vitruviy','cardSort')?.[viewKey]??{};
    const scales=game.user.getFlag('vitruviy','cardScales')?.[viewKey]??{};
    const textScales=game.user.getFlag('vitruviy','cardTextScales')?.[viewKey]??{};
    const textScale=type=>{const value=Number(textScales[type]??1);return Number.isFinite(value)?Math.min(1.5,Math.max(.6,value)):1;};
    const sizes=game.user.getFlag('vitruviy','cardGridSizes')?.[viewKey]??{};
    const viewportStyle=type=>{const size=sizes[type];return size&&Number.isFinite(size.width)&&Number.isFinite(size.height)?`width:${Math.max(240,Math.min(8192,size.width))}px;height:${Math.max(160,Math.min(8192,size.height))}px`:'';};
    const cardScale=type=>{const value=Number(scales[type]??1);return Number.isFinite(value)?Math.min(1.5,Math.max(.6,value)):1;};
    const {groups:cardGroups,children:chargeChildren}=indexCards(this.actor.items);
    const ordered=new Map([...cardGroups].map(([type,items])=>[type,orderCards(items,sorting[type])]));
    this._windCollapsed=collapsed;this._windLayouts={};
    if(usesCardGrid())for(const type of GRID_CATEGORIES){const limit=panelGridLimit(type),geometry=gridViewportGeometry(this._windViewportWidths?.[type]??Math.max(240,(this.position?.width??1040)-100),cardScale(type),limit);this._windLayouts[type]=layoutCards(ordered.get(type),{collapsed:collapsed.includes(type),manual:!sorting[type]||sorting[type]==='manual',columns:geometry.columns,boundsColumns:limit,limit,minRows:geometry.rows});}
    const opacity=type=>Math.min(100,Math.max(0,Number(game.user.getFlag('vitruviy','cardGridOpacity')?.[viewKey]?.[type]??game.settings.get('vitruviy','cardGridOpacity')??25)));
    const descriptions=new Map(await Promise.all(this.actor.items.map(async item=>[item.id,await itemTextHTML(item.system.description,item)])));
    const statuses=await Promise.all([...conditionViews(this.actor),...itemEffectViews(this.actor)].map(async status=>{
      const item=game.items.find(i=>i.getFlag('vitruviy','statusId')===status.statusId);
      const effect=status.effectId?this.actor.effects.get(status.effectId):this.actor.effects.find(e=>!e.disabled&&e.statuses.has(status.statusId));
      return {...status,tooltip:`<strong>${escape(status.name)}</strong><div class="vit-item-rich">${await itemTextHTML(item?.system.description??effect?.description??'',item??this.actor)}</div>`};
    }));
    return Object.assign(c, {actor: this.actor, system: this.actor.system, limited,editValues:this.isEditable&&game.user.getFlag('vitruviy','sheetEditing')?.[viewKey]===true,
      gearTab:!this._sheetTab||this._sheetTab==='equipment',informationTab:this._sheetTab==='information',effectsTab:this._sheetTab==='effects',sheetId:this.id,
      activeEffects:await Promise.all(this.actor.effects.map(async effect=>{const view=effectPresentation(effect);return {id:effect.id,name:effect.name,img:effect.img,disabled:effect.disabled,sourceName:(effect.origin?await fromUuid(effect.origin):null)?.name??'',descriptionHTML:await itemTextHTML(view.description,this.actor,{secrets:this.actor.isOwner}),changes:view.changes};})),
      biographyHTML: await foundry.applications.ux.TextEditor.enrichHTML(this.actor.system.biography, {secrets: this.actor.isOwner, relativeTo: this.actor}),
      notesHTML: await foundry.applications.ux.TextEditor.enrichHTML(this.actor.system.notes, {secrets: this.actor.isOwner, relativeTo: this.actor}),
      customResources:customResourceViews(this.actor),
      currencies: currencyTypes().map(entry => ({...entry, value: this.actor.system.currencies?.[entry.id] ?? 0})),
      attributes: ATTRIBUTES.map((key, i) => ({key, label: t(key), value: this.actor.system.attributes[key],attack:attributePool(this.actor,key,'attack'),defense:attributePool(this.actor,key,'defense'),baseValue:this.actor._source.system.attributes[key], icon: ["heart-pulse", "eye", "person-running", "hand-fist", "brain", "comments"][i]})),
      healthPercent: this.actor.system.health.max ? Math.max(0, Math.min(100, 100 * this.actor.system.health.value / this.actor.system.health.max)) : 0,
      groups: [...panels,...CATEGORIES.filter(type=>!GRID_CATEGORIES.includes(type))].map(type => ({type,panelClosed:panelClosed.includes(type),panelFirst:panels.indexOf(type)===0,panelLast:panels.indexOf(type)===panels.length-1,preparedCount:cardGroups.get(type).filter(item=>item.system.prepared===true).length,scalable:GRID_CATEGORIES.includes(type),gridMode:usesCardGrid()&&GRID_CATEGORIES.includes(type),gridRows:this._windLayouts[type]?.rows??12,gridColumns:this._windLayouts[type]?.columns??18,gridLimit:panelGridLimit(type),viewportStyle:viewportStyle(type),overflowItems:cardGroups.get(type).filter(i=>this._windLayouts[type]?.overflow.has(i.id)).map(i=>({id:i.id,name:i.name,img:i.img})),gridOpacity:opacity(type),gridOpacityValue:opacity(type)/100,cardTextScale:textScale(type),cardTextScalePercent:Math.round(textScale(type)*100),cardScale:cardScale(type),cardScalePercent:Math.round(cardScale(type)*100), label: categoryLabel(type), condition: type === "condition", filtered:sorting[type]&&sorting[type]!=='manual', collapsed: type === "condition" || collapsed.includes(type),
        items: ordered.get(type).map(i => ({gridOverflow:this._windLayouts[type]?.overflow.has(i.id)??false,gridStyle:(()=>{const rect=this._windLayouts[type]?.rects.get(i.id);return rect?`grid-column:${rect.x+1}/span ${rect.w};grid-row:${rect.y+1}/span ${rect.h}`:'';})(),iconCollapsed:collapsed.includes(type)||i.system.gridCollapsed===true,id: i.id, name: i.name, img: i.img, system: i.system, modifier: tierModifier(i.system.tier),...itemAvailability(i),showQuantity:Number.isSafeInteger(i.system.quantity)&&i.system.quantity!==1,chargeSourceName:this.actor.items.get(i.system.chargeSourceId)?.name??t('ChargeSourceUnavailable'),chargeReceiverName:this.actor.items.get(i.system.chargeReceiverId)?.name??t('ChargeSourceUnavailable'),chargeChildren:chargeChildren.get(i.id)??[],
          descriptionHTML:descriptions.get(i.id),tooltip:`<strong>${escape(i.name)}</strong><div class="vit-item-rich">${descriptions.get(i.id)}</div>`,
          rollEnabled: i.system.rollEnabled || i.system.inspirationEnabled, condition: type === "condition", equipment: type === "equipment", ability: type === "ability"}))})),
      statuses,
      editInspiration:this.isEditable&&game.user.isGM&&game.user.getFlag("vitruviy","sheetEditing")?.[viewKey]===true,
      canSpendInspiration: this.isEditable && this.actor.system.inspiration.value > 0,
      tokenizer: game.modules.get("tokenizer-2")?.active && !!game.modules.get("tokenizer-2")?.api?.openEditor});
  }
  static async onToggleGridCard(_event,target){try{await toggleGridCard(this,target);}catch(error){ui.notifications.warn(error.message);}}
  static async onTogglePrepared(_event,target){
    if(!this.isEditable)return;
    const item=this.actor.items.get(target.closest('[data-item-id]').dataset.itemId);
    if(item&&CATEGORIES.includes(categoryOf(item)))await item.update({'system.prepared':!item.system.prepared});
  }
  static async onConfigureResource(_event,target){
    const key=this.actor.uuid.replace(/\W/g,'_');
    if(!this.isEditable||game.user.getFlag('vitruviy','sheetEditing')?.[key]!==true)return;
    try{await configureCustomResource(this.actor,target.dataset.resourceId);}catch(error){ui.notifications.error(error.message);}
  }
  static async onToggleEffect(_event,target){
    if(!this.isEditable)return;const effect=this.actor.effects.get(target.closest('[data-effect-id]').dataset.effectId);
    if(effect)await effect.update({disabled:!effect.disabled});
  }
  static async onDeleteEffect(_event,target){
    if(!this.isEditable)return;const id=target.closest('[data-effect-id]').dataset.effectId;
    if(await foundry.applications.api.DialogV2.confirm({window:{title:t('Delete')},content:`<p>${escape(this.actor.effects.get(id)?.name)}</p>`}))await this.actor.deleteEmbeddedDocuments('ActiveEffect',[id]);
  }
  static async onTransferCurrency(){
    if(!this.isEditable)return;
    try{await transferCurrency(this.actor);}catch(error){ui.notifications.error(error.message);}
  }
  static onSheetTab(_event,target){this._selectSheetTab(target.dataset.tab);}
  _selectSheetTab(tab){
    if(!['equipment','information','effects'].includes(tab))return;
    const content=this.element.querySelector('.vit-tab-content');
    this._tabScroll??={};this._tabScroll[this._sheetTab??'equipment']=content?.scrollTop??0;
    this._sheetTab=tab;
    for(const panel of this.element.querySelectorAll('[data-sheet-panel]'))panel.hidden=panel.dataset.sheetPanel!==tab;
    for(const button of this.element.querySelectorAll('.vit-side-tabs [role="tab"]')){
      const active=button.dataset.tab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
    }
    if(content)content.scrollTop=this._tabScroll[tab]??0;
  }
  static async onOpenStatus(_event,target){const data=target.closest('[data-status-id]').dataset;if(data.effectId)return this.actor.effects.get(data.effectId)?.sheet.render(true);await openCondition(this.actor,data.statusId);}
  static async onRemoveStatus(_event,target){if(!this.isEditable)return;const data=target.closest('[data-status-id]').dataset;if(data.effectId)return this.actor.deleteEmbeddedDocuments('ActiveEffect',[data.effectId]);await this.actor.toggleStatusEffect(data.statusId,{active:false});}
  static async onToggleEdit(){
    if(!this.isEditable)return;
    const key=this.actor.uuid.replace(/\W/g,'_');
    const flags=foundry.utils.deepClone(game.user.getFlag('vitruviy','sheetEditing')??{});
    flags[key]=flags[key]!==true;
    await game.user.setFlag('vitruviy','sheetEditing',flags);this.render(false);
  }
  static async onRollBranch(_event,target){if(this.isEditable)try{await rollAttribute(this.actor,target.dataset.attribute,{branch:target.dataset.branch});}catch(error){ui.notifications.error(error.message);}}
  static async onRoll(_event, target) { if (this.isEditable) try { await rollAttribute(this.actor, target.dataset.attribute); } catch (e) { ui.notifications.error(e.message); } }
  static async onCoin(_event, target) {
    if (!this.isEditable || this._coinPending) return;
    this._coinPending = true; target.disabled = true;
    try { await rollCoin({actor: this.actor}); } catch (error) { ui.notifications.error(error.message); }
    finally { this._coinPending = false; target.disabled = false; }
  }
  static async onItemRoll(_event, target) {
    if (!this.isEditable || this._itemRollPending) return;
    this._itemRollPending = true;
    try { await rollItem(this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId)); }
    catch (error) { ui.notifications.error(error.message); }
    finally { this._itemRollPending = false; }
  }
  static async onToggleCards(_event, target) {
    const key = this.actor.uuid.replace(/\W/g, "_");
    const views = foundry.utils.deepClone(game.user.getFlag("vitruviy", "cardViews") ?? {});
    const types = new Set(views[key] ?? []);
    if (types.has(target.dataset.type)) types.delete(target.dataset.type); else types.add(target.dataset.type);
    views[key] = [...types];
    await game.user.setFlag("vitruviy", "cardViews", views);
    this.render(false);
  }
  static async onTogglePanel(_event,target){
    const type=target.dataset.type;if(!GRID_CATEGORIES.includes(type))return;
    const key=this.actor.uuid.replace(/\W/g,'_'),closed=game.user.getFlag('vitruviy','panelClosed')?.[key]??[];
    await game.user.setFlag('vitruviy',`panelClosed.${key}`,closed.includes(type)?closed.filter(value=>value!==type):[...closed,type]);this.render(false);
  }
  static async onMovePanel(_event,target){
    const type=target.dataset.type,key=this.actor.uuid.replace(/\W/g,'_'),order=panelOrder(game.user.getFlag('vitruviy','panelOrder')?.[key]);
    const index=order.indexOf(type),next=index+Number(target.dataset.direction);if(index<0||next<0||next>=order.length)return;
    [order[index],order[next]]=[order[next],order[index]];await game.user.setFlag('vitruviy',`panelOrder.${key}`,order);this.render(false);
  }
  static async onCreate(_event, target) {
    if (!this.isEditable) return;
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{name: t("NewCard"), type:'card',system:{category:target.dataset.type},sort:Math.max(0,...this.actor.items.map(i=>i.sort??0))+100000}]);
    item.sheet.render(true);
  }
  async setCardSort(type,mode){
    const key=this.actor.uuid.replace(/\W/g,'_');
    const flags=foundry.utils.deepClone(game.user.getFlag('vitruviy','cardSort')??{});
    flags[key]??={};flags[key][type]=mode;await game.user.setFlag('vitruviy','cardSort',flags);this.render(false);
  }
  static async onFilter(_event,target){
    const type=target.dataset.type,key=this.actor.uuid.replace(/\W/g,'_');
    const current=game.user.getFlag('vitruviy','cardSort')?.[key]?.[type]??'manual';
    const choices=['manual','nameAsc','nameDesc','quantityDesc','quantityAsc'];
    const value=await foundry.applications.api.DialogV2.prompt({classes:['vitruviy','vit-dialog'],window:{title:t('FilterCards')},content:`<div class="vit-roll-form"><label>${t('Order')}<select name="order">${choices.map(k=>`<option value="${k}" ${current===k?'selected':''}>${t(k)}</option>`).join('')}</select></label></div>`,ok:{label:t('Apply'),callback:(_e,b)=>b.form.elements.order.value},rejectClose:false});
    if(choices.includes(value))await this.setCardSort(type,value);
  }
  async _onSortItem(event,item){
    if(!this.isEditable)return;
    const target=event.target.closest('[data-item-id]');if(!target||target.dataset.itemId===item.id)return;
    const destination=this.actor.items.get(target.dataset.itemId);if(!destination)return;
    const category=categoryOf(destination);
    const elements=[...target.parentElement.children].filter(e=>e.dataset.itemId);
    const from=elements.findIndex(e=>e.dataset.itemId===item.id),to=elements.indexOf(target);
    const siblings=elements.filter(e=>e.dataset.itemId!==item.id).map(e=>this.actor.items.get(e.dataset.itemId));
    const rect=target.getBoundingClientRect();
    const sortBefore=from>=0?from>to:event.clientX<rect.left+rect.width/2;
    if(categoryOf(item)!==category)await item.update({'system.category':category});
    await this.setCardSort(category,'manual');
    const updates=foundry.utils.performIntegerSort(item,{target:destination,siblings,sortBefore});
    return this.actor.updateEmbeddedDocuments('Item',updates.map(u=>({_id:u.target.id,...u.update})));
  }
  static async onEdit(_event, target) { this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId)?.sheet.render(true); }
  static async onDelete(_event, target) {
    if (!this.isEditable) return;
    const id = target.closest("[data-item-id]").dataset.itemId;
    if (await foundry.applications.api.DialogV2.confirm({window: {title: t("Delete")}, content: `<p>${escape(this.actor.items.get(id)?.name)}</p>`})) await this.actor.deleteEmbeddedDocuments("Item", [id]);
  }
  static async onPublish(_event, target) {
    if (!this.isEditable) return;
    await publishCard(this.actor.items.get(target.closest("[data-item-id]").dataset.itemId));
  }
  static async onTokenizer() {
    const key = this.actor.uuid.replace(/\W/g, '_');
    if (this.isEditable && game.user.getFlag('vitruviy','sheetEditing')?.[key] === true) await game.modules.get("tokenizer-2")?.api?.openEditor(this.actor, this.token ?? null);
  }
  static async onResource(_event, target) {
    if (!this.isEditable || this._resourcePending) return;
    this._resourcePending = true;
    try {
      const key = target.dataset.resource;
      if (!["health", "inspiration", "experience"].includes(key)) return;
      if(key==='inspiration'&&Number(target.dataset.delta)===-1)return await spendInspiration(this.actor);
      if (key === "inspiration" && Number(target.dataset.delta) > 0 && !game.user.isGM) return;
      const value = Math.max(0, this.actor.system[key].value + Number(target.dataset.delta));
      await this.actor.update({[`system.${key}.value`]: key === "health" ? Math.min(value, this.actor.system.health.max) : value});
    } finally { this._resourcePending = false; }
  }
}
export class VitruviyItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static async onToggleItemEdit(){
    if(!this.isEditable)return;
    if(this._itemEditing)await this.submit();
    this._itemEditing=!this._itemEditing;
    await this.render();
  }
  async _processSubmitData(event,form,data,options={}){
    if(!this._itemEditing||!this.isEditable)return;
    const type=data.system?.category??categoryOf(this.item);
    if(this.item.actor&&usesCardGrid()&&GRID_CATEGORIES.includes(type)&&((data.system?.gridWidth!==undefined&&Number(data.system.gridWidth)!==this.item.system.gridWidth)||type!==categoryOf(this.item)))return resizeGridItem(this.item,data,options);
    return super._processSubmitData(event,form,data,options);
  }
  _processFormData(event,form,formData){
    const data=super._processFormData(event,form,formData);
    if(data.system?.chargesMaxFormula?.trim())try{
      chargeMaximum({...this.item.system,...data.system},this.item.actor??{system:{attributes:Object.fromEntries(ATTRIBUTES.map(key=>[key,1]))}});
    }catch{throw Error(t('InvalidChargeFormula'));}
    return data;
  }
  static DEFAULT_OPTIONS = {classes: ["vitruviy", "vit-item"], position: {width: 550, height: 720}, window: {resizable: true}, form: {submitOnChange: true, closeOnSubmit: false}, actions: {toggleItemEdit:this.onToggleItemEdit,addActionMode:this.onAddActionMode,editActionMode:this.onEditActionMode,deleteActionMode:this.onDeleteActionMode,itemTab:this.onItemTab,clearChargeReceiver:this.onClearChargeReceiver,clearChargeSource:this.onClearChargeSource,publish: this.onPublish, rollItem: this.onItemRoll}};
  static PARTS = {body: {template: "systems/vitruviy/templates/item.hbs"}};
  async _prepareContext(options) { return Object.assign(await super._prepareContext(options), {item: this.item, system: this.item.system,itemEditing:this.isEditable&&this._itemEditing===true,canEditItem:this.isEditable,actionModeViews:modeViews(this.item),chargeFormulaError:chargeFormulaError(this.item),gridSizes:{3:'3 × 6',4:'4 × 6',5:'5 × 6'},...(this.item.actor?itemAvailability(this.item):{}),consumesQuantity:this.item.system.quantityUsage==='consume'||(this.item.system.quantityUsage==='auto'&&this.item.system.chargeReceiverId&&!this.item.system.chargesEnabled&&!this.item.system.chargeSourceId),
    customResourceOptions:{'':'—',...Object.fromEntries(resourceDefinitions().map(entry=>[entry.id,entry.name])),...(this.item.system.customResourceId&&!resourceDefinitions().some(entry=>entry.id===this.item.system.customResourceId)?{[this.item.system.customResourceId]:t('CustomResourceUnavailable')}:{})},
    quantityUsageModes:{auto:t('QuantityAuto'),none:t('QuantityNoConsume'),consume:t('QuantityConsume')},
    itemDescriptionTab:!this._itemTab||this._itemTab==='description',itemActivationTab:this._itemTab==='activation'||this._itemTab==='effects',
    areaPlacements:{self:t('AreaPlacement_self'),point:t('AreaPlacement_point')},
    areaShapes:Object.fromEntries(['circle','cone','line','rectangle'].map(key=>[key,t(`AreaShape_${key}`)])),
    branches:{base:t('BaseAttribute'),attack:t('Attack'),defense:t('Defense')},
    effectTargets:{self:t('EffectSelf'),target:t('EffectTarget')},effectAttributes:{choose:t('EffectChoose'),...Object.fromEntries(ATTRIBUTES.map(k=>[k,t(k)]))},
    chargeSource:this.item.actor?.items.get(this.item.system.chargeSourceId),chargeReceiver:this.item.actor?.items.get(this.item.system.chargeReceiverId),
    descriptionValue:itemEditorText(this.item.system.description),privateDescriptionValue:this.isEditable?itemEditorText(this.item.system.privateDescription):'',
    descriptionHTML:await itemTextHTML(this.item.system.description,this.item,{secrets:this.item.isOwner}),
    privateDescriptionHTML:this.isEditable?await itemTextHTML(this.item.system.privateDescription,this.item,{secrets:true}):'', attributes: Object.fromEntries(ATTRIBUTES.map(k => [k, t(k)])),
    tiers: Object.fromEntries(Object.entries(TIERS).map(([tier, modifier]) => [tier, `${tier} · ${modifier}`])), modifier: tierModifier(this.item.system.tier),
    categories:Object.fromEntries(CATEGORIES.map(k=>[k,categoryLabel(k)])),category:categoryOf(this.item),canUse: !!this.item.actor, condition: categoryOf(this.item) === "condition", equipment: categoryOf(this.item) === "equipment", ability: categoryOf(this.item) === "ability"}); }
  async _onRender(context,options){
    await super._onRender(context,options);
    const header=this.element.querySelector('.window-header');
    if(header){
      let toggle=header.querySelector('.vit-title-edit');
      if(!context.canEditItem)toggle?.remove();
      else{
        if(!toggle){
          toggle=document.createElement('button');toggle.type='button';
          toggle.className='vit-edit-toggle vit-title-edit';toggle.dataset.action='toggleItemEdit';
          toggle.setAttribute('role','switch');toggle.setAttribute('aria-label',t('EditValues'));toggle.title=t('EditValues');
          toggle.innerHTML='<i class="fa-solid fa-pen" aria-hidden="true"></i><span class="vit-toggle-track" aria-hidden="true"></span>';
          header.prepend(toggle);
        }
        toggle.setAttribute('aria-checked',String(context.itemEditing));
      }
    }
    this._itemGroups??={};
    for(const group of this.element.querySelectorAll('[data-item-group]')){
      const key=group.dataset.itemGroup;
      if(Object.hasOwn(this._itemGroups,key))group.open=this._itemGroups[key];else this._itemGroups[key]=group.open;
      group.addEventListener('toggle',()=>{this._itemGroups[key]=group.open;});
    }
    const tabs=[...this.element.querySelectorAll('.vit-item-tabs [role="tab"]')];
    for(const tab of tabs)tab.tabIndex=tab.getAttribute('aria-selected')==='true'?0:-1;
    this.element.querySelector('.vit-item-tabs')?.addEventListener('keydown',event=>{
      const index=tabs.indexOf(event.target);if(index<0)return;
      const next={ArrowRight:(index+1)%tabs.length,ArrowLeft:(index+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[event.key];
      if(next===undefined)return;event.preventDefault();VitruviyItemSheet.onItemTab.call(this,event,tabs[next]);tabs[next].focus();
    });
    if(!this.isEditable||!this._itemEditing)return;
    for(const zone of this.element.querySelectorAll('.vit-charge-source')){
    zone.addEventListener('dragover',event=>{event.preventDefault();event.stopPropagation();});
    zone.addEventListener('drop',async event=>{
      event.preventDefault();event.stopPropagation();
      try{
        const data=foundry.applications.ux.TextEditor.getDragEventData(event);
        if(data.type!=='Item' || typeof data.uuid!=='string')throw new Error(t('ChargeDropItem'));
        const receiver=zone.dataset.chargeRole==='receiver';
        const document=(receiver?validateChargeReceiver:validateChargeSource)(this.item,await fromUuid(data.uuid));
        await this.item.update({[receiver?'system.chargeReceiverId':'system.chargeSourceId']:document.id});
      }catch(error){ui.notifications.error(error.message);}
    });
    }
  }
  static async onAddActionMode(){if(this.isEditable)await editActionMode(this.item);}
  static async onEditActionMode(_event,target){if(this.isEditable)await editActionMode(this.item,target.dataset.modeId);}
  static async onDeleteActionMode(_event,target){if(this.isEditable)await deleteActionMode(this.item,target.dataset.modeId);}
  static onItemTab(_event,target){
    const tab=target.dataset.tab==='effects'?'activation':target.dataset.tab;if(!['description','activation'].includes(tab))return;
    this._itemTab=tab;
    for(const panel of this.element.querySelectorAll('[data-item-panel]'))panel.hidden=panel.dataset.itemPanel!==tab;
    for(const button of this.element.querySelectorAll('[data-action="itemTab"]')){button.setAttribute('aria-selected',String(button.dataset.tab===tab));button.tabIndex=button.dataset.tab===tab?0:-1;}
  }
  static async onClearChargeReceiver(){if(this.isEditable)await this.item.update({'system.chargeReceiverId':''});}
  static async onClearChargeSource(){if(this.isEditable)await this.item.update({'system.chargeSourceId':''});}
  static async onPublish() { if (this.isEditable) await publishCard(this.item); }
  static async onItemRoll() {
    if (!this.isEditable || this._itemRollPending) return;
    this._itemRollPending = true;
    try { await rollItem(this.item); } catch (error) { ui.notifications.error(error.message); }
    finally { this._itemRollPending = false; }
  }
}
export async function publishCard(item) {
  if (!item?.isOwner) throw new Error(t("NoPermission"));
  const descriptionHTML=await itemTextHTML(item.system.description,item);
  const data = {speaker: ChatMessage.getSpeaker({actor: item.actor}), content: `<article class="vit-chat"><header><img class="vit-chat-item-icon" src="${escape(item.img ?? "icons/svg/item-bag.svg")}" alt="">${escape(item.name)}</header>${item.system.quantity > 1 ? `<p>${t("Quantity")}: ${item.system.quantity}</p>` : ""}<p>${t(categoryOf(item))}${item.system.hasTier!==false ? ` · ${t("Tier")}: ${escape(item.system.tier)}` : ""}</p><div class="vit-description vit-item-rich">${descriptionHTML}</div>${item.system.inspirationEnabled ? `<p>${t("Cost")}: ${item.system.cost}</p>` : ""}</article>`};
  ChatMessage.applyMode(data);
  return ChatMessage.create(data);
}
