var db = require('../db.js');
var SQLHelper = require('../helpers/sqlHelper');
var NewSQLHelper = require('../helpers/newSQLHelper');
var Element = require('./element');
var ElementType = require('./element_type');
var Voltage = require('./voltage');
var Substation = require('./substation');

var tableName = "bus_reactors";
var tableAttributes = ["id", "elements_id", "mvar"];
var squel = require("squel");
var async = require("async");
var vsprintf = require("sprintf-js").vsprintf;
//id is primary key
//elements_id is unique

exports.tableColumnNames = tableAttributes;
exports.tableName = tableName;

var creationSQL = function (elementNameSQLVar, elementDescriptionSQLVar, silSQLVar, mvarSQLVar, stabilityLimitSQLVar, thermalLimitSQLVar, elementTypeNameSQLVar, elementTypeIdSQLVar, voltageSQLVar, voltageIdSQLVar, noLoadMvarSQLVar, elementIdSQLVar, ownerNameSQLVars, ownerMetadataSQLVars, ownerRegionNameSQLVars, ownerRegionIdSQLVar, ownerIdSQLVar, elementRegionNamesSQLVars, elementRegionIdsSQLVar, stateNamesSQLVars, stateIdsSQLVar, substationNameSQLVars, substationVoltageSQLVars, brIdSQLVar, replace) {
    var delimiter = ";";
    var sql = "";
    //create the element
    sql += Element.creationSQL1(elementNameSQLVar, elementDescriptionSQLVar, silSQLVar, stabilityLimitSQLVar, thermalLimitSQLVar, elementTypeNameSQLVar, elementTypeIdSQLVar, voltageSQLVar, voltageIdSQLVar, elementIdSQLVar, ownerNameSQLVars, ownerMetadataSQLVars, ownerRegionNameSQLVars, ownerRegionIdSQLVar, ownerIdSQLVar, elementRegionNamesSQLVars, elementRegionIdsSQLVar, stateNamesSQLVars, stateIdsSQLVar, substationNameSQLVars, substationVoltageSQLVars, brIdSQLVar, replace);
    sql += delimiter;
    //create an entry in the bus_reactors table
    sql += NewSQLHelper.getSQLInsertReplaceString(tableName, tableAttributes.slice(1), [elementIdSQLVar, mvarSQLVar], tableAttributes[0], brIdSQLVar);
    return sql;
};

exports.create = function (name, description, voltage, sil, mvar, ownerNames, regions, states, substationNames, substationVoltages, replace, done) {
    var values = [name, description, voltage, mvar];
    var delimiter = ";";
    var brIdSQLVar = "@brId";
    var sql = "";

    for (var i = 0; i < ownerNames.length; i++) {
        values.push(ownerNames[i]);
    }
    for (var i = 0; i < regions.length; i++) {
        values.push(regions[i]);
    }
    for (var i = 0; i < states.length; i++) {
        values.push(states[i]);
    }
    for (var i = 0; i < substationNames.length; i++) {
        values.push(substationNames[i]);
        values.push(substationVoltages[i]);
    }

    sql += "START TRANSACTION READ WRITE" + delimiter;
    var elementNameSQLVar = "@name";
    sql += NewSQLHelper.setVariableSQLString(elementNameSQLVar, "?");
    sql += delimiter;
    var elementDescriptionSQLVar = "@description";
    sql += NewSQLHelper.setVariableSQLString(elementDescriptionSQLVar, "?");
    sql += delimiter;

    var stabilityLimitSQLVar = "@stabilityLimit";
    sql += NewSQLHelper.setVariableSQLString(stabilityLimitSQLVar, "0");
    sql += delimiter;
    var thermalLimitSQLVar = "@thermalLimit";
    sql += NewSQLHelper.setVariableSQLString(thermalLimitSQLVar, "0");
    sql += delimiter;
    var elementTypeNameSQLVar = "@typeName";
    sql += NewSQLHelper.setVariableSQLString(elementTypeNameSQLVar, "\"Bus Reactor\"");
    sql += delimiter;
    var voltageSQLVar = "@voltage";
    sql += NewSQLHelper.setVariableSQLString(voltageSQLVar, "?");

    sql += delimiter;
    var silSQLVar = "@sil";
    sql += NewSQLHelper.setVariableSQLString(silSQLVar, "0");

    sql += delimiter;
    var mvarSQLVar = "@brMvar";
    sql += NewSQLHelper.setVariableSQLString(mvarSQLVar, "?");

    sql += delimiter;
    var noLoadMvarSQLVar = "@noLoadMvar";
    sql += NewSQLHelper.setVariableSQLString(noLoadMvarSQLVar, "0");

    var ownerNameSQLVar = "@ownerName";
    var ownerMetadataSQLVar = "@ownerMetadata";
    var ownerRegionNameSQLVar = "@ownerRegion";
    var ownerNameSQLVars = [];
    var ownerMetadataSQLVars = [];
    var ownerRegionNameSQLVars = [];

    var substationNameSQLVar = "@substationName";
    var substationVoltageSQLVar = "@substationVoltage";

    for (var i = 0; i < ownerNames.length; i++) {
        sql += delimiter;
        ownerNameSQLVars[i] = ownerNameSQLVar + i;
        sql += NewSQLHelper.setVariableSQLString(ownerNameSQLVars[i], "?");
        sql += delimiter;
        ownerMetadataSQLVars[i] = ownerMetadataSQLVar + i;
        sql += NewSQLHelper.setVariableSQLString(ownerMetadataSQLVars[i], "\"No_Metadata\"");
        sql += delimiter;
        ownerRegionNameSQLVars[i] = ownerRegionNameSQLVar + i;
        sql += NewSQLHelper.setVariableSQLString(ownerRegionNameSQLVars[i], "\"NA\"");
    }
    var elementRegionNamesSQLVar = "@regionName";
    var elementRegionNamesSQLVars = [];
    for (var i = 0; i < regions.length; i++) {
        sql += delimiter;
        elementRegionNamesSQLVars[i] = (elementRegionNamesSQLVar + i);
        sql += NewSQLHelper.setVariableSQLString(elementRegionNamesSQLVars[i], "?");
    }
    var stateNamesSQLVar = "@stateName";
    var stateNamesSQLVars = [];
    for (var i = 0; i < states.length; i++) {
        sql += delimiter;
        stateNamesSQLVars[i] = stateNamesSQLVar + i;
        sql += NewSQLHelper.setVariableSQLString(stateNamesSQLVars[i], "?");
    }
    var substationNameSQLVars = [];
    var substationVoltageSQLVars = [];
    for (var i = 0; i < substationNames.length; i++) {
        sql += delimiter;
        substationNameSQLVars[i] = substationNameSQLVar + i;
        sql += NewSQLHelper.setVariableSQLString(substationNameSQLVars[i], "?");
        sql += delimiter;
        substationVoltageSQLVars[i] = substationVoltageSQLVar + i;
        sql += NewSQLHelper.setVariableSQLString(substationVoltageSQLVars[i], "?");
    }
    sql += delimiter;
    sql += creationSQL(elementNameSQLVar, elementDescriptionSQLVar, silSQLVar, mvarSQLVar, stabilityLimitSQLVar, thermalLimitSQLVar, elementTypeNameSQLVar, "@typeId", voltageSQLVar, "@voltageId", noLoadMvarSQLVar, "@elementId", ownerNameSQLVars, ownerMetadataSQLVars, ownerRegionNameSQLVars, "@ownerRegionId", "@ownerId", elementRegionNamesSQLVars, "@elementRegionId", stateNamesSQLVars, "@stateId", substationNameSQLVars, substationVoltageSQLVars, brIdSQLVar, replace);
    sql += delimiter;
    sql += "COMMIT" + delimiter;
    sql += "SELECT " + brIdSQLVar + " AS brId" + delimiter;
    console.log(sql + "\n\n\n");
    console.log(values);
    db.get().query(sql, values, function (err, rows) {
        if (err) return done(err);
        //console.log(JSON.stringify(rows));
        done(null, rows);
    });
};

//create the element and get the elementId
var getBusReactorElementIdByAttrs = exports.getBusReactorElementIdByAttrs = function (voltage, elem_num, mvar, substationNames, substationVoltages, done, conn) {
    var tempConn = conn;
    if (conn == null) {
        tempConn = db.get();
    }

    var tempResults = {
        brElems: [],
        brTypeId: null,
        ssTypeId: null,
        voltageId: null,
        ssIds: []
    };

    var getBrTypeId = function (callback) {
        ElementType.getByTypeWithCreation("Bus Reactor", function (err, rows) {
            if (err) {
                return callback(err);
            }
            var elemTypeId = rows[0].id;
            tempResults.brTypeId = elemTypeId;
            callback(null, tempResults);
        }, tempConn);
    };

    var getSSTypeId = function (prevRes, callback) {
        ElementType.getByTypeWithCreation("Substation", function (err, rows) {
            if (err) {
                return callback(err);
            }
            var elemTypeId = rows[0].id;
            prevRes.ssTypeId = elemTypeId;
            callback(null, prevRes);
        }, tempConn);
    };

    var getVoltageId = function (prevRes, callback) {
        Voltage.getByLevelWithCreation(voltage, function (err, rows) {
            if (err) {
                return callback(err);
            }
            var voltageId = rows[0].id;
            prevRes.voltageId = voltageId;
            callback(null, prevRes);
        }, tempConn);
    };

    var getSSIds = function (prevRes, callback) {
        var elementNamesOrExp = squel.expr();
        for (var i = 0; i < substationNames.length; i++) {
            elementNamesOrExp.or(squel.expr().and(Element.tableColumnNames[1] + " = ?", substationNames[i]).and(Element.tableColumnNames[7] + " = ?", prevRes.voltageId));
        }

        var elemsWhereExp = squel.expr()
            .and(Element.tableColumnNames[6] + " = ?", prevRes.ssTypeId)
            .and(elementNamesOrExp);

        var getSql = squel.select()
            .field(Element.tableName + ".*")
            .field(Substation.tableName + "." + Substation.tableColumnNames[0], "ss_id")
            .from(Element.tableName)
            .where(elemsWhereExp)
            .order('ss_id')
            .join(Substation.tableName, null, "elements.id = substations.elements_id");

        var query = getSql.toParam().text;
        var vals = getSql.toParam().values;
        //console.log(query);
        //console.log(vals);
        tempConn.query(query, vals, function (err, rows) {
            if (err) return callback(err);
            var ssRows = rows;
            //console.log(ssRows);
            for (var i = 0; i < ssRows.length; i++) {
                prevRes.ssIds.push(ssRows[i].ss_id);
            }
            callback(null, prevRes);
        });
    };

    // tableAttributes = ["id", "name", "description", "sil", "stability_limit", "thermal_limit", "element_types_id", "voltages_id", "elem_num"];
    var getBrElems = function (prevRes, callback) {
        var sql = "SELECT \
* \
FROM \
( \
SELECT \
ss.substations_id AS ss_id, \
el.*, \
br.mvar, \
GROUP_CONCAT( \
DISTINCT ss.substations_id \
ORDER BY \
ss.substations_id ASC SEPARATOR '|||' \
) AS ss_ids \
FROM \
elements AS el \
LEFT JOIN \
elements_has_substations ss ON ss.elements_id = el.id \
LEFT JOIN \
bus_reactors br ON br.elements_id = el.id \
GROUP BY \
el.id \
ORDER BY \
el.name ASC \
) AS el_tb \
WHERE \
el_tb.ss_ids = ? AND el_tb.element_types_id = ? AND el_tb.voltages_id = ? AND el_tb.elem_num = ? AND el_tb.mvar = ?";

        var vals = [prevRes.ssIds.join('|||'), prevRes.brTypeId, prevRes.voltageId, elem_num, mvar];
        //console.log(sql);
        //console.log(vals);
        tempConn.query(sql, vals, function (err, rows) {
            if (err) return callback(err);
            var brElemRows = rows;
            //console.log(brElemRows);
            prevRes.brElems = brElemRows;
            callback(null, prevRes);
        });
    };
    //get the elements_
    var functionsArray = [getBrTypeId, getSSTypeId, getVoltageId, getSSIds, getBrElems];
    async.waterfall(functionsArray, function (err, prevRes) {
        if (err) return done(err);
        done(null, prevRes.brElems);
    });
};

var plainCreate = exports.plainCreate = function (element_id, mvar, done, conn) {
    var tempConn = conn;
    if (conn == null) {
        tempConn = db.get();
    }
    var sql = squel.insert()
        .into(tableName)
        .set(tableAttributes[1], element_id)
        .set(tableAttributes[2], mvar);
    var query = sql.toParam().text;
    //query += " ON DUPLICATE KEY UPDATE name = name;";
    query += vsprintf(" ON DUPLICATE KEY UPDATE %s = %s;", [tableAttributes[1], tableAttributes[1]]);
    var getSql = squel.select()
        .from(tableName)
        .where(
        squel.expr()
            .and(tableAttributes[1] + " = ?", element_id)
    );
    query += getSql.toParam().text;
    var vals = sql.toParam().values.concat(getSql.toParam().values);
    //console.log(query);
    //console.log(vals);
    tempConn.query(query, vals, function (err, rows) {
        if (err) return done(err);
        done(null, rows[1]);
    });
};

var getWithCreationWithoutTransaction = exports.getWithCreationWithoutTransaction = function (name, description, sil, stabilityLimit, thermalLimit, voltage, elem_num, ownerNames, regions, states, substationNames, substationVoltages, mvar, done, conn) {
    // create bus reactor and get the element id
    var tempConn = conn;
    if (conn == null) {
        tempConn = db.get();
    }
    var tempResults = {
        elementId: null,
        busReactorId: null,
        elements: [],
        busReactors: []
    };

    // find the line Element Id by attributes
    var getBrElemIdByAttrs = function (callback) {
        getBusReactorElementIdByAttrs(voltage, elem_num, mvar, substationNames, substationVoltages, function (err, brElems) {
            if (err) return callback(err);
            var elementId = null;
            console.log("*************************************************************************************************");
            //console.log(brElems);
            if (brElems.length > 0) {
                console.log("Bus Reactor Already present...");
                elementId = brElems[0].id;
            }
            tempResults.elementId = elementId;
            tempResults.elements = brElems;
            callback(null, tempResults);
        }, tempConn);
    };

    //create the element and get the elementId
    var getElementId = function (prevRes, callback) {
        if (prevRes.elementId != null) {
            console.log("Bus Reactor Element creation avoided...");
            return callback(null, prevRes);
        }
        console.log("*************************************************************************************************");
        console.log("Bus Reactor not present so creating a new one...");
        var ownerRegions = ownerNames.map(function (x) {
            return "NA";
        });
        Element.getWithCreation(name, description, sil, stabilityLimit, thermalLimit, "Bus Reactor", voltage, elem_num, ownerNames, ownerNames, ownerRegions, regions, states, substationNames, substationVoltages, function (err, rows) {
            if (err) return callback(err);
            var elementId = rows[0].id;
            tempResults.elementId = elementId;
            tempResults.elements = rows;
            callback(null, tempResults);
        }, tempConn)
    };

    var getBusReactorId = function (prevRes, callback) {
        plainCreate(prevRes.elementId, mvar, function (err, rows) {
            if (err) return callback(err);
            var busReactorId = rows[0].id;
            tempResults.busReactorId = busReactorId;
            tempResults.busReactors = rows;
            prevRes.busReactorId = busReactorId;
            prevRes.busReactors = rows;
            callback(null, prevRes);
        }, tempConn)
    };

    //create the elements_
    var functionsArray = [getBrElemIdByAttrs, getElementId, getBusReactorId];
    async.waterfall(functionsArray, function (err, prevRes) {
        if (err) return done(err);
        console.log("From Bus Reactor Creation********************");
        console.log(prevRes);
        done(null, prevRes.busReactors);
    });
};

var getWithCreation = exports.getWithCreation = function (name, description, sil, stabilityLimit, thermalLimit, voltage, elem_num, ownerNames, regions, states, substationNames, substationVoltages, mvar, done, conn) {
    var tempConn = conn;
    if (conn == null) {
        db.getPoolConnection(function (err, poolConnection) {
            if (err) return done(err);
            tempConn = poolConnection;
            tempConn.beginTransaction(function (err) {
                //console.log("transaction started...");
                if (err) {
                    tempConn.release();
                    return done(err);
                }
                getWithCreationWithoutTransaction(name, description, sil, stabilityLimit, thermalLimit, voltage, elem_num, ownerNames, regions, states, substationNames, substationVoltages, mvar, function (err, rows) {
                    if (err) {
                        //console.log("error in owner name creation...");
                        tempConn.rollback(function () {
                            //console.log("transaction rollback done ...");
                            tempConn.release();
                            return done(err);
                        });
                        return;
                    }
                    tempConn.commit(function (err) {
                        if (err) {
                            //console.log("error in transaction commit ...");
                            tempConn.rollback(function () {
                                //console.log("error in transaction commit rollback ...");
                                tempConn.release();
                                return done(err);
                            });
                        }
                        //console.log("transaction committed successfully ...");
                        tempConn.release();
                        done(null, rows);
                    });
                }, tempConn);
            });
        });
    } else {
        getWithCreationWithoutTransaction(name, description, sil, stabilityLimit, thermalLimit, voltage, elem_num, ownerNames, regions, states, substationNames, substationVoltages, mvar, function (err, rows) {
            if (err) return done(err);
            done(null, rows);
        }, tempConn);
    }
};

exports.creationSQL = creationSQL;