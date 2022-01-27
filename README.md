## Javascript function sequencing

Quick and dirty script sequencer. Create function trees, add async/requestAnimationFrame or delays, and subscribe to tagged outputs in the trees.

`npm i anothersequencer`

Usage:

```js
import {Sequencer} from 'anothersequencer' //or copy the html
//import {Sequencer} from './Sequencer.js'
//in HTML: <script type='module' src='./Sequencer.js></script>
//or for lazy: 
//document.head.insertAdjacentHTML(`<script type='module' src='./Sequencer.js></script>`)

let sequencer = new Sequencer();

//simple
let sequence1 = [
    (input){console.log('1'); return 2;},
    (input){console.log(input); return 3;}, //should log "2"
    (input) => {console.log(input)} //yeah whatever
];

//complex
let sequence2 = [{
    tag:'begin',
    operation:(input)=>{}, //the callback
    next:[{
        delay:100, //milisecond delay before this operation is called
        operation:(input)=>{}, //next callback
        next:[ //functions on the next layer receive the previous layer's input and not each other's sequential input unlike the simpler sequence
            {
                tag:'anotheroperation', //tags let you subscribe to these results
                delay:100,
                operation:async (input)=>{}, //etc
            }, 
            {
                operation:async (input)=>{},
                frame:true, //uses requestAnimationFrame which is a special async function for frame and context-limited calls
                next:'anothersequence' //can set 
            }
        ]
    }]
}];

let sequence3 = { //can use objects for sequences instead of arrays
    tag:'a',
    operation:(input)=>{}, //the callback
    next:{ //objects instead of arrays
        tag:'b',
        operation:(input)=>{},
        next:[{
            tag:'c',
            operation:(input)=>{},
            next:(prev) => {} //could set a function as the final .next operation
        }
        ///,{...}
      ]
    }
}

let onResult = (input) => {
    console.log(input);
}

sequencer.addSequence('test1',sequence1);
sequencer.addSequence('test2',sequence2);
sequencer.addSequence('test3',sequence3);

sequencer.runSequence('test1'); //can also tell it what layer to run from if there are multiple

let sub = sequencer.subscribeToOperation('anotheroperation',onResult); //adds a triggered function on result
//You could even, say, subscribe one tagged sequence to another tagged sequence.

//sequencer.unsubscribeFromOperation('anotheroperation',sub); //leave sub blank to remove all triggers. 

```

Other functions less obvious to use:

```js
sequencer.getSequence(
    name,
    layer //optional
);
```
```js
sequencer.appendSequence(
     name, //name of sequence
    layer, //layer 2 is the second layer, etc. leave blank to append on first layer
    setting={ //object or function, functions cannot have more layers added
    //operation = (result) => {} //callback for the sequence, takes the previous result
    //delay:undefined, //set to a millisecond value
    //async:undefined //set async:true or frame:true depending on if you want normal async or frame-timed async (which also won't run if you are out of the tab)
    }, 
    index //if you are appending to .next of an operation in a particular sequence layer you can use  this. Leave blank to just add the setting to the specified layer instead
)
```
```js
sequencer.removeSequence(
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

