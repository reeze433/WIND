const RU={самочувствие:'wellbeing',внимание:'attention',движение:'movement',сражение:'combat',мышление:'thinking',общение:'communication'};
const KEYS=['wellbeing','attention','movement','combat','thinking','communication'];
const FUNCTIONS={floor:Math.floor,ceil:Math.ceil,round:Math.round,abs:Math.abs,min:Math.min,max:Math.max};

// A small arithmetic grammar, never JavaScript evaluation or dice execution.
export function resourceFormula(source,attributes={},context={}){
  if(typeof source!=='string'||!source.trim()||source.length>300)throw new Error('Invalid resource formula');
  const input=source.toLowerCase().replace(/атт?рибут_\*/gu,'атрибут_').replace(/−/g,'-').replace(/×/g,'*').replace(/÷/g,'/');
  const tokens=input.match(/\d+(?:\.\d+)?|@?[a-zа-яё_][a-zа-яё_0-9.]*|[()+\-*/,]|\S/gu)??[];
  if(tokens.length>120)throw new Error('Formula too complex');
  let position=0,depth=0;
  const checked=value=>{if(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)throw new Error('Invalid formula result');return value;};
  const take=()=>tokens[position++];
  function primary(){
    if(++depth>32)throw new Error('Formula too deep');
    const token=take();let value;
    if(token==='+'||token==='-')value=(token==='-'?-1:1)*primary();
    else if(token==='('){value=expression();if(take()!==')')throw new Error('Expected closing bracket');}
    else if(/^\d+(?:\.\d+)?$/.test(token??''))value=Number(token);
    else if(Object.hasOwn(FUNCTIONS,token??'')){
      if(take()!=='(')throw new Error('Expected function bracket');
      const args=[expression()];while(tokens[position]===','){take();args.push(expression());}
      if(take()!==')'||(!['min','max'].includes(token)&&args.length!==1))throw new Error('Invalid function arguments');
      value=FUNCTIONS[token](...args);
    }else{
      const name=String(token??'').replace(/^@/,'').replace(/^(?:system\.)?attributes\./,'').replace(/^атт?рибут_/u,'');
      if(['максимум','maximum','maxvalue','max'].includes(name))value=Number(context.maximum);
      else{const key=RU[name]??name;if(!KEYS.includes(key))throw new Error('Unknown attribute');value=Number(attributes[key]);}
    }
    depth--;return checked(value);
  }
  function product(){let value=primary();while(['*','/'].includes(tokens[position])){const operator=take(),right=primary();if(operator==='/'&&right===0)throw new Error('Division by zero');value=checked(operator==='*'?value*right:value/right);}return value;}
  function expression(){let value=product();while(['+','-'].includes(tokens[position])){const operator=take(),right=product();value=checked(operator==='+'?value+right:value-right);}return value;}
  const result=expression();if(position!==tokens.length)throw new Error('Unexpected formula text');return checked(result);
}
