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
    operation:(input)=>{
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
            delay:1000, //ms delay for this call
            operation:(input)=>{
                console.log('b',input);
                return 7;
            },
            next:'a' //or can end with another sequence tag
        }
    ]
}

sequencer.addSequence('b',sequence2);

sequencer.runSequence('b',4);
```

```js

let sub = sequencer.subscribeToOperation('anotheroperation',onResult); //or .subscribe //adds a triggered function on result
//You could even, say, subscribe one tagged sequence to another tagged sequence.

sequencer.unsubscribeFromOperation('anotheroperation',sub); //or .unsubscribe //leave sub blank to remove all triggers. 

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
    //operation = (result) => {} //callback for the sequence, takes the previous result
    //delay:undefined, //set to a millisecond value
    //async:undefined //set async:true or frame:true depending on if you want normal async or frame-timed async (which also won't run if you are out of the tab)
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

