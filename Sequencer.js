//Simple script sequencer
// Joshua Brewster AGPL v3.0

// let sequence = {
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
//                  next:[{...}]
//                },
//                (lastResult) => {} //can input plain functions into the next sequence layers if you want just some simple one-off calls
//             ]
//          ]
//     }],
//     anothersequence:{
//         //etc
//     }
// }

import {StateManager} from 'anotherstatemanager'

export class Sequencer {
    constructor() {
        this.sequences = new Map();
        this.state = new StateManager(
            undefined,
            undefined,
            false
        ); //triggered-only state manager (no overhead)
    }

    addSequence(name,sequence=[]) {
        this.sequences.set(name,sequence);
    }

    runSequence(name, runFromLayer=1) {
        let sequence = this.sequences.get(name);
        if(sequence) {
            if(runFromLayer > 1) {
                let i = 2;
                let nextlayer = sequence.next;
                while(i < runFromLayer) {
                    nextlayer = nextlayer.next;
                }
                this.runSequenceLayer(nextlayer);
            }
            else {
                this.runSequenceLayer(sequence);
            }
        }
    }

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

    async runSequenceLayer(layer=[],previousResult) {
        layer.forEach((o) => {
            if(typeof o === 'function') {
                if(o.constructor.name == 'AsyncFunction') previousResult = await o(previousResult); //if the functions are in a basic sequence this passes results along
                else previousResult = o(previousResult); //can just shove functions into the sequencer
            
            }
            else if(o.delay) { 
                if(o.async) { //async
                    setTimeout(
                        async ()=>{
                            let result = await o.operation(previousResult);
                            if(o.tag) this.state.setState(o.tag,result);
                            if(o.next) await this.runSequenceLayer(o.next,result);
                        },
                        o.delay
                    );
                }
                else if (o.frame && requestAnimationFrame) { //or frame-timed operations
                    setTimeout(()=> {
                        requestAnimationFrame(()=>{
                            let result = o.operation(previousResult);
                            if(o.tag) this.state.setState(o.tag,result);
                            if(o.next) this.runSequenceLayer(o.next,result);
                        });
                    }, o.delay)
                }
                else {
                    setTimeout(
                        () => {
                            let result = layer.operation(previousResult);
                            if(o.tag) this.state.setState(o.tag,result);
                            if(o.next) this.runSequenceLayer(o.next,result);
                        },
                        o.delay
                    );
                }
            }
            else {
                if(o.async) {
                    let result = await o.operation(previousResult);
                    if(o.tag) this.state.setState(o.tag,result);
                    if(o.next) await this.runSequenceLayer(o.next,result);
                }
                else if (o.frame) {
                    requestAnimationFrame(()=>{
                        let result = o.operation(previousResult);
                        if(o.tag) this.state.setState(o.tag,result);
                        if(o.next) this.runSequenceLayer(o.next,result);
                    });
                }
                else {
                    let result = o.operation(previousResult);
                    if(o.tag) this.state.setState(o.tag,result);
                    if(o.next) await this.runSequenceLayer(o.next,result);
                }
            }
        });
    }

    //subscribes to a tagged operation
    subscribeToOperation(tag,callback=(result)=>{}) {
        if(tag)
            return this.state.subscribeTrigger(tag,callback);
    }

    unsubscribeFromOperation(tag, sub) {
        if(tag) {
            if(sub) this.state.unsubscribeTrigger(tag,sub);
            else this.state.unsubscribeAllTriggers(tag);
        }
    }

}

export default Sequencer