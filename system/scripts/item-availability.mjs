// Publishing a declaration is allowed even when its resource pools are empty.
export function itemAvailability(item){return {useDisabled:!item?.isOwner,useReason:''};}
