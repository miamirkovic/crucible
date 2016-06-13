var responseThermo;
var oldTime=0;
var tempBoard, tempChamber, tempTarget, tempFluid, pressure, pressTarget, LUX, luxTarget;
var oldTempTarget=0;
var LEDBrightness=0,luxPWM=0;
var incomingTempTarget, incomingPressTarget, incomingLuxTarget;
var v1=0,v2=0,v3=0,v4=0;
var arduinoReady=true;
var messageInQue=false;

var hysteresisReset=true;
var ventStatus=false;

//thermolators
var ThermoScientific=false;
var Julabo=false;

(function(){

//Server Side Updated
//Reset Arduino
// var gpio =Meteor.npmRequire('rpi-gpio');
// gpio.setup(4, gpio.DIR_OUT, write);


// function write() {
//     gpio.write(4  , true, function(err) {
//         if (err) throw err;
//         console.log('Written to pin');
//     });
// }

var sendToArduino = function(message) {
  serialPort.write(message);
};

var sendToThermo = function(message) {
  serialPortThermo.write(message);
};

var SerialPort = Meteor.npmRequire('serialport');

var SerialPortReset = Meteor.npmRequire('serialport');
var serialPortArduinoReset = new SerialPort.SerialPort('/dev/ttyS0', {
  baudrate: 1200,
  parser: SerialPort.parsers.readline('\r\n')
});


//Change baudrate in Julabo from 4800 to 19200
var serialPortThermo = new SerialPort.SerialPort('/dev/ttyUSB0',{
  baudrate: 19200,
  parser: SerialPort.parsers.readline('\r\n')
   });

var serialPort = new SerialPort.SerialPort('/dev/ttyS0', {
  baudrate: 115200,
  parser: SerialPort.parsers.readline('\r\n')
});

//reset arduino 
//var SerialPortArduinoReset = Meteor.npmRequire('serialport');


Meteor.startup(function() {
  console.log("meteor is starting");
});


serialPortArduinoReset.on('open', function() {
  console.log('Reseting');
  //serialPortArduinoReset.close();
  serialPortArduinoReset.close(function (err) {
    console.log('Arduino Reset', err);
  });
});



var messagePub;
Meteor.publish('messages', function() {
  messagePub = this;
  return this.ready();
});


serialPort.on('open', function() {
  console.log('Port Arduino open');
});

serialPortThermo.on('open', function() {
  console.log('Port Thermo open');
  ThermoScientific=true;
});


serialPortThermo.on('data',Meteor.bindEnvironment(function(data){
console.log("Direct from Thermo: "+data+"\n");
responseThermo=data;
}));


serialPort.on('data', Meteor.bindEnvironment(function(data) {
  

  var parsedData = JSON.parse(data);
  if (parsedData.messageType === 'getAll') {
    Meteor.call('askFluidTemp' );

    tempBoard=parsedData.TempBoard;
    tempChamber=parsedData.TempChamber;
    tempTarget=incomingTempTarget;
    //tempTarget=parsedData.tempTarget;
    tempFluid=responseThermo;
    pressure=parsedData.Pressure;
    pressTarget=incomingPressTarget;
    //pressTarget=parsedData.pressTarget;
    LUX=parsedData.LUX;
    luxTarget=incomingLuxTarget;
    //luxTarget=parsedData.luxTarget;
   // LEDBrightness=parsedData.Brightness;

    //writeToConsole();
    console.log('Board Temp: '+tempBoard+
            "C\nTemp Setpoint: "+tempTarget+
            " C\nChamber Temp: "+tempChamber+
            " C\nFluid Temp: " +tempFluid+
            " C\nPressure: "+pressure+
            " psi\nPressure Setpoint: "+pressTarget+
            " psi\nLux Setpoint: "+luxTarget+
            " \nLUX: "+LUX+  
            "\nLED Brightness: "+Math.round(LEDBrightness));


    controlCheck(luxTarget,LUX,pressTarget,pressure,tempTarget,tempFluid);      
  
    //writeToSite();
    var tmpDoc = { 
      created: new Date(),
      messageType: 'getAll',
      tempBoard: tempBoard,
      tempChamber: tempChamber,
      tempFluid: responseThermo,
      tempTarget: tempTarget,
      pressure: pressure,
      pressTarget: pressTarget,
      LUX: LUX,
      luxTarget: luxTarget,
      LEDBrightness: Math.round(LEDBrightness)
     };
     messagePub.added('messages', Random.id(), tmpDoc);
  } 
}));

Meteor.methods({

  toServer: function(tempSet,luxSet,pressSet,vent,todo){
    //messageInQue=true;
    incomingLuxTarget=luxSet;
    incomingPressTarget=pressSet;
    incomingTempTarget=tempSet;
    ventStatus=vent;
  },

  updateArduino: function(luxPWM,v1,v2,v3,v4,todo){
    var messageToArduino="{\"luxPWM\":"+luxPWM+",\"vS\":["+v1+","+v2+","+v3+","+v4+"],\"rst\":1,\"todo\":"+todo+"}";
      sendToArduino(new Buffer(messageToArduino));
      console.log(messageToArduino);
      //if (oldTempTarget!=tempTarget){
        oldTempTarget=tempTarget;
        Meteor.call('updateThermo',tempTarget);
      //}
  },
  
  updateThermo: function(tempSet) {
    if(ThermoScientific){
      var messageThermo="W SP "+ tempSet+ '\r\n';
      sendToThermo(new Buffer(messageThermo));
      console.log(messageThermo);
    }
    if(Julabo){
      var messageThermo="A032_out_sp_00 "+tempSet+'\r\n';
      sendToThermo(new Buffer(messageThermo));
      console.log(messageThermo);
    }
  },
  
  textThermo: function(textThermo) {
    var messageThermo=textThermo+'\r\n';
    console.log(messageThermo);
    sendToThermo(new Buffer(messageThermo));
  },

  runThermo: function(thermoRun) {
    if(ThermoScientific){
      var messageThermo=thermoRun+'\r\n';
      sendToThermo(new Buffer(messageThermo));
      console.log(messageThermo);
    }
    if(Julabo){
      var messageThermo="A032_out_mode_05 "+thermoRun+'\r\n';
      sendToThermo(new Buffer(messageThermo));
      console.log(messageThermo);
    }
  },

  askFluidTemp: function(){
    if(ThermoScientific){
        var messageThermo='R T1\r\n';
        sendToThermo(new Buffer(messageThermo));
        console.log(messageThermo);
      }
      if(Julabo){
        var messageThermo="A032_in_pv_00 "+'\r\n';
        sendToThermo(new Buffer(messageThermo));
        console.log(messageThermo);
      }
  },

  message: function(newDoc) {
    messagePub.added('messages', Random.id(), newDoc);
  },

  removeMessage: function(_id) {
    messagePub.removed('messages', _id);
  }

});

}).call(this);


controlCheck = function(luxTarget,LUX,pressTarget,pressure,tempTarget,tempFluid){
  var operation=0;
  if (Math.abs(luxTarget-LUX)>50){
    luxPWM=luxControl(LUX,luxTarget,LEDBrightness);
    LEDBrightness=Number(luxPWM/255*100);
    if (isNaN(LEDBrightness)){LEDBrightness=0;}
    operation+=2;
    
    v1=0; v2=0; v3=0;v4=0;

  }

  if(Math.abs(pressTarget-pressure)>.01){
    operation+=1;

    //if (pressTarget-pressure<-.3){
    if (pressure/pressTarget<.97){
      v1=0;
      v2=0;
      v3=0;
      v4=255;
      hysteresisReset=true;
    }
      else{
      var date=new Date();
      var currentTime=date.getSeconds()+(date.getMilliseconds()/1000);
      var timePassed=currentTime-oldTime;
      var pressureError=PIDPressure( pressure, pressTarget, Number(timePassed),hysteresisReset);
      oldTime=currentTime;

      if (pressureError>0){
        v1=0;
        v2=10+Math.abs(pressureError);
        v3=0;
        v4=0;
      }

      if (pressureError<0){
        v2=0;
        v1=0;
        v3=10+Math.abs(pressureError);
        v4=0;
      }
      hysteresisReset=false;
    }
  }
  if (ventStatus){v1=255;v2=0;}
  Meteor.call('updateArduino', Math.round(luxPWM), v1,v2,v3,v4,operation);

 }