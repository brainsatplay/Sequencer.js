//just a more typical hierarchical graph tree with back and forward prop and arbitrary 
// go-here-do-that utilities. Create an object node tree and make it do... things 
// same setup as sequencer but object/array/tag only (no functions), and can add arbitrary properties to mutate on objects
// or propagate to children/parents with utility calls that get added to the objects

//Also, untested

/*
Design Philosophy:

Acyclic graphs are trees of operations with arbitrary entry and exit points plus arbitrary propagation of results through the tree.

Each node is an object with a few required properties and functions and then anything else you want to add as variables, reference, utility functions etc. 
Nodes added to the graph tree are made into a 'graphnode' class object with some added utility functions added to allow generic message passing between parent/child/any nodes.
There are additional properties to indicate whether to delay (or render on frame), repeat or recurse, and do automatic forward or backprop based on the tree hierarchy.

Each node comes with an 'operator' main function to handle input and output with arbitrary conditions. 
Tagged nodes are indexed as callable entry points to the tree.
Node operations return results via a promise as well as propagating based on available default object settings. All else is built into the custom main 'operator()' functions you add

The 'operator()' function in each node is a program for that node that passes an input, the node, and the origin node if it's passing the input. 
It can and should return results which can be used for propagation to other nodes automatically or for returning results from a chain of operations 
starting with the called node. This is like a 'main()' program in a file where the node is the script's scope with local properties

Tagged node operation results can also be subscribed to with via an internal state manager from anywhere in your program so you don't need to add more lines to operators to output to certain places.
*/


/*
let tree = { //top level should be an object, children can be arrays of objects
    tag:'top',
    operator(input,node,origin){ //if arrow function, use node as the 'this' reference
        if(typeof input === 'object')) {
            if(input.x) this.x = input.x;
         }
         return input;
    }, //input is the previous result if passed from another node. node is 'this' node, origin is the previous node if passed
    forward:true, //forward prop: returned outputs from the operator are passed to children operator(s)
    //backward:true, //backprop: returned outputs from the operator are passed to the parent operator
    x:3, //arbitrary properties available on the node variable in the operator 
    y:2,
    z:1,
    children:{ //object, array, or tag. Same as the 'next' tag in Sequencer.js
        tag:'next', //tagged nodes get added to the node map by name, they must be unique! non-tagged nodes are only referenced internally e.g. in call trees
        operator:(input,node,origin)=>{ //arrow function in this scope means it preserves the parent scope if the parent scope is not an arrow
            if(origin.x) node.x = origin.x; //e.g. propagating coordinates down a tree (e.g. in a hierarchical 3D model)
            return input;
        }, // if you use a normal function operator(input,node,origin){} then you can use 'this' reference instead of 'node', while arrow functions using a different scope still have a local reference.
        //etc..
    }//,
    //delay:1000//, //can timeout the operation
    //frame:true //can have the operation run via requestAnimationFrame (throttling)
    //repeat:3 //can repeat an operator, or use "recursive" for the same but passing the node's result back in
};


let graph = new AcyclicGraph();
graph.addNode(tree);

graph.run('top',{x:1});

each node in the tree becomes a graphnode object

*/

//a graph representing a callstack of nodes which can be arranged arbitrarily with forward and backprop or propagation to wherever
export class AcyclicGraph {
    constructor() {
    
        this.nodes = new Map();
    
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
    
    //convert child objects to nodes
    convertToNodes(n) {
        if(typeof n.children === 'object') {
            n.children = new graphnode(n.children,n,this);
            this.convertToNodes(n.children);
            if(n.children.tag) this.nodes.set(n.children.tag,n.children);
        } else if (Array.isArray(n.children)) {
            for(let i = 0; i < n.children.length; i++) {
                n.children[i] = new graphnode(nn,n,this);
                this.convertToNodes(n.children[i]);
                if(n.children[i].tag) this.nodes.set(n.children[i].tag,n.children[i]);
            }
        } else if (typeof n.children === 'string') {
            n.children = this.getNode(n.children);
        }
    }

    addNode(node={}) {
        if(!node.tag) node.tag = `top${Math.floor(Math.random()*10000000)}`; //add a random id for the top index if none supplied
        let tree = new graphnode(node,undefined,this);
        this.convertToNodes(tree);
        this.nodes.set(tree.tag,tree);
        return tree;
    }

    getNode(tag) {
        return this.nodes.get(tag);
    }

    removeNode(tag) {
        this.nodes.delete(tag);
    }

    appendNode(node={}, parentNode) {
        parentNode.addChildren(node);
    }

    async runNode(node,input,origin) {
        if(typeof node === 'string') node = this.nodes.get(key);

        return new Promise((resolve) => {
            if(node) {
                let run = async (node, inp, tick=1) => {
                    return new Promise ((r) => {
                        let res = await node.runOp(inp,node,origin);
                        if(typeof node.repeat === 'number') {
                            while(tick < node.repeat) {
                                if(node.delay) {
                                    setTimeout(async ()=>{
                                        res = await node.runOp(inp,node,origin);
                                        tick++;
                                        if(tick < node.repeat) {
                                            run(node,inp,tick);
                                        } else r(res);
                                    },node.delay);
                                    break;
                                } else if (node.frame && requestAnimationFrame) {
                                    requestAnimationFrame(async ()=>{
                                        res = await node.runOp(inp,node,origin);
                                        tick++;
                                        if(tick < node.repeat) {
                                            run(node,inp,tick);
                                        } else r(res);
                                    });
                                    break;
                                }
                                else res = await node.runOp(inp,node,origin);
                                tick++;
                            }
                            if(tick === node.repeat) r(res);
                        } else if(typeof node.recursive === 'number') {
                            
                            while(tick < node.recursive) {
                                if(node.delay) {
                                    setTimeout(async ()=>{
                                        res = await node.runOp(inp,node,origin);
                                        tick++;
                                        if(tick < node.recursive) {
                                            run(node,res,tick);
                                        } else r(res);
                                    },
                                        node.delay);
                                    break;
                                } else if (node.frame && requestAnimationFrame) {
                                    requestAnimationFrame(async ()=>{
                                        res = await node.runOp(inp,node,origin);
                                        tick++;
                                        if(tick < node.recursive) {
                                            run(node,res,tick);
                                        } else r(res);
                                    });
                                    break;
                                }
                                else res = await node.runOp(res,node,origin);
                                tick++;
                            }
                            if(tick === node.recursive) r(res);
                        }
                        else {
                            r(res);
                        }
                    });
                }

                let res = await run(node,input); //repeat/recurse before moving on to the parent/child

                if(node.backward && node.parent) {
                    await node.callParent(res);
                }
                if(node.children && node.forward) {
                    await node.callChildren(res);
                }     
                
                //you could return an object {} kept as a node property from the parent node operation, one that is mutated by the parents or children before resolving the promise,
                // thus reporting results from chained operations

                resolve(res);
            }
            resolve(undefined);
        });
    }


    subscribe(tag,callback=(res)=>{}) {
        return this.state.subscribeTrigger(tag,callback);
    }

    unsubscribe(tag,sub) {
        this.state.unsubscribeTrigger(tag,sub);
    }

}

//the utilities in this class can be referenced in the operator after setup for more complex functionality
class graphnode {
    constructor(node={}, parent, graph={}) {
        Object.assign(this,node); //set the node's props as this
        this.parent=parent;
        this.graph=graph;
    }

    //I/O scheme for this node
    operator(input,node=this,origin){
        return input;
    }

    //this is the i/o handler, or the 'main' function for this node to propagate results. The origin is the node the data was propagated from
    setOperator(operator=function operator(input,node=this,origin){return input;}) {
        this.operator = operator;
    }

    async runOp(input,node=this,origin) {
        let result = await this.operator(input,node, origin);
        if(this.tag) this.graph.setState({[this.tag]:result});
        return result;
    }

    setParent(parent) { 
        this.parent = parent;
    }

    addChildren(children) {
        if(!Array.isArray(this.children)) this.children = [this.children];
        if(Array.isArray(children)) this.children.push(...children);
        else this.children.push(children);
    }

    convertToNodes(n) {
        if(typeof n.children === 'object') {
            n.children = new graphnode(n.children,n,this.graph);
            convertToNodes(n.children);
        } else if (Array.isArray(n.children)) {
            for(let i = 0; i < n.children.length; i++) {
                n.children[i] = new graphnode(nn,n,this.graph);
                convertToNodes(n.children[i]);
            }
        }
    }

    async callParent(input){
        if(typeof this.parent?.operator === 'function') await this.parent.runOp(input,this.parent,this);
    }
    
    async callChildren(input, idx){
        let result;
        if(Array.isArray(this.children)) {
            if(idx) result = await this.children[idx]?.runOp(input,this.children[idx],this);
            else {
                result = [];
                for(let i = 0; i < this.children.length; i++) {
                    result.push(await this.children[idx]?.runOp(input,this.children[idx],this));
                } 
            }
        } else {
            result = await this.children.runOp(input,this.children,this);
        }
        return result;
    }

    setProps(props={}) {
        Object.assign(this,props);
    }

}
