var HID = require('node-hid');

function Controller(index)
{
    if (!arguments.length) {
        index = 0;
    }

    var controllers = HID.devices(11044, 1);

    if (!controllers.length) {
        throw new Error("No keepkeys could be found");
    }

    if (index > controllers.length || index < 0) {
        throw new Error("Index " + index + " out of range, only " + controllers.length + " keepkeys found");
    }

    var hid = new HID.HID(controllers[index].path);

    hid.write([ 0x3F, 35, 35, 0, 0, 0, 0, 0, 0 /*, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 */ ]);

    hid.on('data', function (data) {
        console.log(data);
    });
}

Controller();