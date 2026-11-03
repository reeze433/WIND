import {currencyTypes} from './presentation.mjs';
export function itemPilesConfiguration() {
  const currencies=currencyTypes();
  return {VERSION:'1.0.0',ACTOR_CLASS_TYPE:'npc',ITEM_CLASS_LOOT_TYPE:'card',ITEM_CLASS_WEAPON_TYPE:'card',ITEM_CLASS_EQUIPMENT_TYPE:'card',ITEM_QUANTITY_ATTRIBUTE:'system.quantity',ITEM_PRICE_ATTRIBUTE:'system.price',
    ITEM_FILTERS:[],ITEM_SIMILARITIES:['name','type','system.category','system.tier','system.description','system.privateDescription','system.rollEnabled','system.attribute','system.dealsDamage','system.inspirationEnabled','system.cost','system.price','system.hasTier','system.chargesEnabled','system.charges.value','system.charges.max','system.chargeCost','system.chargeSourceId','system.sourceChargeCost','system.chargeReceiverId','system.restoreChargeAmount','system.chargeRestoreFull','flags.vitruviy.chargeUses','flags.vitruviy.quantityUses','system.customResourceId','system.customResourceCost','system.quantityUsage','system.quantityCost','system.effectEnabled','system.effectName','system.effectTarget','system.effectAttribute','system.effectBonus'],
    CURRENCY_DECIMAL_DIGITS:1,
    CURRENCIES:currencies.slice(0,1).map(c=>({type:'attribute',name:c.name,abbreviation:'{#} '+c.name,img:'icons/svg/coins.svg',primary:true,exchangeRate:1,data:{path:`system.currencies.${c.id}`}})),
    SECONDARY_CURRENCIES:currencies.slice(1).map(c=>({type:'attribute',name:c.name,abbreviation:'{#} '+c.name,img:'icons/svg/coins.svg',data:{path:`system.currencies.${c.id}`}})),
    ITEM_TRANSFORMER:data=>({...data,system:{quantity:1,price:0,...data.system}}),
    PREVIEW_ITEM_TRANSFORMER:data=>({...data,system:{...data.system,privateDescription:''}})};
}
export function installItemPiles(){if(game.modules.get('item-piles')?.active)game.itempiles.API.addSystemIntegration(itemPilesConfiguration());}
Hooks.once('setup',installItemPiles);

let syncQueue=Promise.resolve();
export async function syncItemPilesCurrencies(){
  if(!game.modules.get('item-piles')?.active || game.users.activeGM?.id!==game.user.id)return;
  const configuration=itemPilesConfiguration();
  for(const [key,entries] of [['currencies',configuration.CURRENCIES],['secondaryCurrencies',configuration.SECONDARY_CURRENCIES]]){
    const current=game.settings.get('item-piles',key)??[];
    const desired=entries.map(entry=>({...entry,img:current.find(old=>old.type==='attribute'&&old.data?.path===entry.data.path)?.img??entry.img}));
    if(JSON.stringify(current)!==JSON.stringify(desired))await game.settings.set('item-piles',key,desired);
  }
  if(game.settings.get('item-piles','currencyDecimalDigits')!==1)await game.settings.set('item-piles','currencyDecimalDigits',1);
  const similarities=game.settings.get('item-piles','itemSimilarities')??[];
  const merged=[...new Set([...similarities,...configuration.ITEM_SIMILARITIES])];
  if(JSON.stringify(similarities)!==JSON.stringify(merged))await game.settings.set('item-piles','itemSimilarities',merged);
}
function scheduleCurrencySync(){syncQueue=syncQueue.then(syncItemPilesCurrencies).catch(console.error);return syncQueue;}
Hooks.once('ready',()=>{
  Hooks.on('updateSetting',setting=>{if(setting.key==='vitruviy.currencyTypes')return scheduleCurrencySync();});
  return scheduleCurrencySync();
});
