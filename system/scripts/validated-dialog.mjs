// Keep values and focus after validation or a cancelled document update.
export function validatedDialog() {
  return class extends foundry.applications.api.DialogV2 {
    async _onSubmit(target,event) {
      const states=[...this.element.querySelectorAll('button[data-action]')].map(button=>[button,button.disabled]);
      try { return await super._onSubmit(target,event); }
      catch(error) {
        for(const [button,disabled] of states)button.disabled=disabled;
        const output=this.element.querySelector('[data-validation-error]');
        if(output){output.textContent=error.message;output.hidden=false;}
        else ui.notifications.error(error.message);
        return this;
      }
    }
  };
}
