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
            setState:(updateObj)=>{
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
            subscribeTrigger:(key,onchange=(res)=>{})=>{
                if(key) {
                    if(!this.triggers[key]) {
                        this.triggers[key] = [];
                    }
                    let l = this.triggers[key].length;
                    this.triggers[key].push({idx:l, onchange:onchange});
                    return this.triggers[key].length-1;
                } else return undefined;
            },
            unsubscribeTrigger:(key,sub)=>{
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

    addSequence(name, sequence=[]) {
        this.sequences.set(name,sequence);
    }

    add=this.addSequence

    async runSequence(name, input, runFromLayer=1) {
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

    run = this.runSequence;

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
                                let result = await o.operation(previousResult);
                                if(o.tag) this.state.setState(o.tag,result);
                                if(o.next) await this.runSequenceLayer(o.next,result);
                            });
                        }, o.delay)
                    }
                    else {
                        setTimeout(
                            async () => {
                                let result = await o.operation(previousResult);
                                if(o.tag) this.state.setState(o.tag,result);
                                if(o.next) await this.runSequenceLayer(o.next,result);
                            },
                            o.delay
                        );
                    }
                }
                else {
                    if (o.frame) {
                        requestAnimationFrame(async ()=>{
                            let result = await o.operation(previousResult);
                            if(o.tag) this.state.setState(o.tag,result);
                            if(o.next) await this.runSequenceLayer(o.next,result);
                        });
                    }
                    else {
                        let result = await o.operation(previousResult);
                        if(o.tag) this.state.setState(o.tag,result);
                        if(o.next) await this.runSequenceLayer(o.next,result);
                    }
                }
            };
        } else if (typeof layer === 'object') {
            let result = await layer.operation(previousResult);
            if(layer.tag) this.state.setState(layer.tag,result);
            if(layer.next) await this.runSequenceLayer(layer.next,result);
        }
    }

    //subscribes to a tagged operation
    subscribeToOperation(tag,callback=(result)=>{}) {
        if(tag)
            return this.state.subscribeTrigger(tag,callback);
    }

    subscribe = this.subscribeToOperation;

    unsubscribeFromOperation(tag, sub) {
        if(tag) {
            if(sub) this.state.unsubscribeTrigger(tag,sub);
            else this.state.unsubscribeAllTriggers(tag);
        }
    }

    unsubscribe = this.unsubscribeFromOperation;

}

export default Sequencer