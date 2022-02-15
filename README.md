## Javascript function sequencing

![status](https://img.shields.io/npm/v/anothersequencer.svg) 
![downloads](https://img.shields.io/npm/dt/anothersequencer.svg)
![size](https://img.shields.io/github/size/brainsatplay/Sequencer.js/Sequencer.js)
![l](https://img.shields.io/npm/l/anothersequencer)

Quick and dirty script sequencer. Create function trees, add async/requestAnimationFrame or delays, and subscribe to tagged outputs in the trees. 

Sequences are created from basic javascript structures with some required and optional variables as specified below, so it's visually/syntactically as intuitive and efficient as possible to write once you get the hang of it (hopefully).
 
`npm i anothersequencer`

For a similarly structured but more technical Acyclic Graph Node sequencer (i.e. trees and forests) with promise-returning sequences and forward/backprop + more simple hierarchical programming utilities: [AcyclicGraph.js](https://github.com/brainsatplay/acyclicgraph.js)

### Usage:
```js
import {Sequencer} from 'anothersequencer' //or copy the html
//import {Sequencer} from './Sequencer.js'
//in HTML: <script type='module' src='./Sequencer.js></script>
//or for lazy: 
//document.head.insertAdjacentHTML(`<script type='module' src='./Sequencer.js></script>`)

let sequencer = new Sequencer();

//simple sequences will pass the previous result along in the order of the array
let sequence1 = [ 
    (input)=>{console.log('a',input); return 1;},
    (input)=>{console.log('a',input); return 2;}, //should log 1
    async (input) => {console.log('a',input); return 3;} //should log 2
];

sequencer.addSequence('a',sequence1); //or .add

sequencer.runSequence('a', 0); //or .run 
//these run async

//complex
let sequence2 = { //create a sequence object or array, can mix and match for each layer as well
    operation:(input)=>{ //.operation, .op, .f, .fn, .callback all work
        console.log('b',input);
        return 5;
    },
    next:[ //Calls here receive the parent result.
        {
            operation:(input)=>{
                console.log('b',input);
                return 6;
            },
            frame:true // can execute with requestAnimationFrame
            next:async (input)=>{console.log('b',input);} //can end with a function
        },
        {
            tag:'repeater'
            delay:1000, //ms delay for this call
            operation:(input)=>{
                console.log('b',input);
                return 7;
            },
            repeat:3, //repeat before moving on, 'recursive' does the same but passes the repeater output back to itself rather than the parent input
            next:'a' //or can end with another sequence tag
        }
    ]
}

sequencer.addSequence('b',sequence2);

sequencer.runSequence('b',4);
```

```js


//add a triggered function on result
sequencer.subscribe('repeater',(res)=>{console.log('subscribed',res)});
//You could even, say, subscribe one tagged sequence to another tagged sequence.

sequencer.unsubscribeFromOperation('repeater',sub); //or .unsubscribe //leave sub blank to remove all triggers. 

```

Other functions less obvious to use:

```js
sequencer.getSequence( //or .get
    name,
    layer //optional
);
```
```js
sequencer.appendSequence( // or .append
     name, //name of sequence
    layer, //layer 2 is the second layer, etc. leave blank to append on first layer
    setting={ //object or function, functions cannot have more layers added
    //operation:(result) => {} //callback for the sequence, takes the previous result
    //delay:undefined, //set to a millisecond value
    //frame:undefined //setframe:true depending on if you want frame-timed async (which won't run if you are outside of the browser context)
    //tag:'xyz', //make subscribable outputs on this layer
    //repeat:3 //recursive:3 //repeater or recursive repeater. Recursion passes this layer's output back in rather than the parent layer
    tab)
    }, 
    index //if you are appending to .next of an operation in a particular sequence layer you can use  this. Leave blank to just add the setting to the specified layer instead
)
```
```js
sequencer.removeSequence( //or .remove
    name,
    layer, //optional
    index //optional
);
```
```js
//this is used recursively by runSequence otherwise to iterate a layer
sequencer.runSequenceLayer(
    layer,
    previousResult
)
```

Joshua Brewster  ---   AGPL v3.0
