var _ = require('lodash');
var ByteBuffer = require('bytebuffer');

module.exports = function(pbMessage) {
    var objReflection = pbMessage.$type;
    var newMessage = _.cloneDeep(pbMessage, function(value, key) {
        if (ByteBuffer.isByteBuffer(value)) {
            return value;
        }
    });

    var enumFields = _.filter(objReflection._fields, function(it) {
        return it.resolvedType && it.resolvedType.className === "Enum";
    });

    _.each(enumFields, function(it) {
        var value = pbMessage[it.name];
        var match = _.find(it.resolvedType.children, {id: value});
        newMessage[it.name] = match.name;
    });

    return newMessage;
};