//Simple script sequencer
// Joshua Brewster AGPL v3.0

// sequencer.sequences = {
//     a:[{
//         operation:(input)=>{},
//         next:[{
//             operation:(input)=>{},
//             next:[
//                {
//                  tag:'second_layer' //tags let you subscribe to these results
//                  operation:async (input)=>{},
//                  delay:100,
//                  async:true //can toggle if the operations should run async
//                }, 
//                {
//                  operation:async (input)=>{},
//                  delay:100,
//                  next:'anothersequence'
//                },
//                (lastResult) => {} //can input plain functions into the next sequence layers if you want just some simple one-off calls
//             ]
//          ]
//     }],
//     anothersequence:{
//         //etc
//     }
// }


export class Sequencer {
    constructor() {
        this.sequences = new Map();
        this.state = {
            pushToState:{},
            data:{},
            triggers:{},
            setState(updateObj){
                Object.assign(this.pushToState,updateObj);
        
                if(Object.keys(this.triggers).length > 0) {
                    // Object.assign(this.data,this.pushToState);
                    for (const prop of Object.getOwnPropertyNames(this.triggers)) {
                        if(this.pushToState[prop]) {
                            this.data[prop] = this.pushToState[prop]
                            delete this.pushToState[prop];
                            this.triggers[prop].forEach((obj)=>{
                                obj.onchange(this.data[prop]);
                            });
                        }
                    }
                }

                return this.pushToState;
            },
            subscribeTrigger(key,onchange=(res)=>{}){
                if(key) {
                    if(!this.triggers[key]) {
                        this.triggers[key] = [];
                    }
                    let l = this.triggers[key].length;
                    this.triggers[key].push({idx:l, onchange:onchange});
                    return this.triggers[key].length-1;
                } else return undefined;
            },
            unsubscribeTrigger(key,sub){
                let idx = undefined;
                let triggers = this.triggers[key]
                if (triggers){
                    if(!sub) delete this.triggers[key];
                    else {
                        let obj = triggers.find((o)=>{
                            if(o.idx===sub) {return true;}
                        });
                        if(obj) triggers.splice(idx,1);
                        return true;
                    }
                }
            },
            subscribeTriggerOnce(key=undefined,onchange=(value)=>{}) {
                let sub;
                let changed = (value) => {
                    onchange(value);
                    this.unsubscribeTrigger(key,sub);
                }

                sub = this.subscribeTrigger(key,changed);
            }
        }
    }

    add(name, sequence=[]) {
        this.sequences.set(name,sequence);
    }

    addSequence = this.add;

    async run(name, input, runFromLayer=1) {
        let sequence = this.sequences.get(name);
        if(sequence) {
            if(runFromLayer > 1) {
                let i = 2;
                let nextlayer = sequence.next;
                while(i < runFromLayer) {
                    nextlayer = nextlayer.next;
                }
                await this.runSequenceLayer(nextlayer, input);
            }
            else {
                await this.runSequenceLayer(sequence, input);
            }
        }
    }

    runSequence = this.run;

    appendSequence(
        name, //name of sequence
        layer, //layer 2 is the second layer, etc.
        setting={ //object or function, functions cannot have more layers added
        //operation = (result) => {} //callback for the sequence, takes the previous result
        //delay:undefined, //set to a millisecond value
        //async:undefined //set async:true or frame:true depending on if you want normal async or frame-timed async (which also won't run if you are out of the tab)
        }, 
        index //append the layer .next callback from a particular index (if the layer has multiple callbacks)
    ) {
        let sequence = this.getSequence(name,layer);
        if(sequence) {
            if(!Array.isArray(sequence)) sequence = [sequence]; //make the sequence layer an array if it isn't
            if(!index) sequence.push(setting);
            else {
                if(!sequence[index]?.next) sequence.next = [];
                sequence[index]?.next.push(setting);
            }
        }
    }

    append = this.appendSequence;

    removeSequence(name,layer,index) {
        let sequence;
        if(layer) sequence = this.getSequence(name,layer-1);
        else sequence = this.getSequence(name); //get the previous layer in case we need to pop the .next variable
        if(sequence) {
            if(index && sequence[index]) sequence.splice(index,1);
            else {
                if(layer && sequence.next) {
                    if(sequence.tag) this.unsubscribeFromOperation(sequence.tag);
                    delete sequence.next;
                }
                else if(sequence) {
                    this.sequences.delete(name);
                }
            }
        }
    }

    remove = this.removeSequence;

    getSequence(name, layer=1) {
        let sequence = this.sequences.get(name);
        if(sequence) {
            if(layer > 1) {
                let i = 2;
                let nextlayer = sequence.next;
                while(i < layer) {
                    if(!nextlayer.next) break;
                    nextlayer = nextlayer.next;
                    i++;
                }
                return nextlayer;
            }
            return sequence;
        }
    }

    get = this.getSequence;

    async runSequenceLayer(layer,previousResult) {

        let run = async (o,prev,tick=1) => {

            //supports different shorthand
            if(o.operation) true;
            else if(o.op) o.operation = o.op;
            else if (o.o) o.operation = o.o;
            else if (o.f) o.operation = o.f;
            else if (o.fn) o.operaiion = o.fn; 
            else if (o.callback) o.operation = o.callback;
            else return prev;

            let result = await o.operation(prev);
            if(o.tag) this.state.setState({[o.tag]:result});
            if(typeof o.repeat === 'number') { //repeats a call with the first result
                let i = tick;
                while(i < o.repeat) {
                    if(o.delay) {
                        setTimeout(async ()=> {
                            if(o.frame) {
                                requestAnimationFrame(async ()=>{
                                    i++;
                                    await run(o,prev,i);
                                });
                            }
                            else {
                                i++
                                await run(o,prev,i);
                            }
                        }, o.delay);
                        break;
                    }
                    else result = await o.operation(prev);
                    i++;
                }
                if(i === o.repeat && o.next) await this.runSequenceLayer(o.next,result);
            } else if (typeof o.recursive === 'number') { //repeats a call but passes new results back in
                let i = tick;
                while(i < o.recursive) {
                    if(o.delay) {
                        setTimeout(async ()=> {
                            if(o.frame) {
                                requestAnimationFrame(async ()=>{
                                    i++;
                                    await run(o,result,i);
                                });
                            }
                            else {
                                i++
                                await run(o,result,i);
                            }
                        }, o.delay);
                        break;
                    }
                    else result = await o.operation(prev);
                    i++;
                }
                if(i === o.recursive && o.next) await this.runSequenceLayer(o.next,result);
            }
            else if(o.next) await this.runSequenceLayer(o.next,result);
        }


        if(typeof layer === 'function') { await layer(previousResult); } //can set functionsi in the .next position
        else if (typeof layer === 'string') { this.runSequence(layer,previousResult); } //can set sequences in the .next position by name
        else if (Array.isArray(layer)) {
            for(let i = 0; i < layer.length; i++) {
                let o = layer[i];
                if(typeof o === 'function') {
                    previousResult = await o(previousResult); //if the functions are in a basic sequence this passes results along
                }
                else if(o.delay) { 
                    if (o.frame && typeof requestAnimationFrame === 'function') { //or frame-timed operations
                        setTimeout(async ()=> {
                            requestAnimationFrame(async ()=>{
                                run(o,previousResult);
                            });
                        }, o.delay)
                    }
                    else {
                        setTimeout(
                            async () => {
                                run(o,previousResult);
                            },
                            o.delay
                        );
                    }
                }
                else {
                    if (o.frame) {
                        requestAnimationFrame(async ()=>{
                            run(o,previousResult);
                        });
                    }
                    else {
                        run(o,previousResult);
                    }
                }
            };
        } else if (typeof layer === 'object') {
            run(layer,previousResult);
        }
    }

    //subscribes to a tagged operation
    subscribe(tag,callback=(result)=>{}) {
        if(tag)
            return this.state.subscribeTrigger(tag,callback);
    }

    subscribeToOperation = this.subscribe;

    unsubscribe(tag, sub) {
        if(tag) {
            this.state.unsubscribeTrigger(tag,sub);
        }
    }

    unsubscribeFromOperation = this.unsubscribe;

}


export default Sequencer