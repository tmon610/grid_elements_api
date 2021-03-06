var db = require('../db.js');
var SQLHelper = require('../helpers/sqlHelper');
var NewSQLHelper = require('../helpers/newSQLHelper');
var Element_type = require('./element_type');
var Voltage = require('./voltage');
var Region = require('./region');
var Element_Region = require('./element_region');
var Owner = require('./owner');
var Element_Owner = require('./element_owner');
var State = require('./state');
var Element_State = require('./element_state');
var Substation = require('./substation');
var Element_Substation = require('./element_substation');
var vsprintf = require("sprintf-js").vsprintf;

var tableName = "elements";
var tableAttributes = ["id", "name", "description", "sil", "stability_limit", "thermal_limit", "element_types_id", "voltages_id", "elem_num"];
var squel = require("squel");
var async = require("async");
//id is primary key
//(name,element_types_id, voltages_id,elem_num) is unique

var nameSQLVar = "@name";
var typeNameSQLVar = "@typename";
var levelSQLVar = "@level";
var ownerSQLVar = "@owner";
var regionNameSQLVar = "@regionname";
var metadataSQLVar = "@metadata";

var elementTypeIdSQLVar = "@elementtypeid";
var voltageIdSQLVar = "@voltageid";
var elementIdSQLVar = "@elementid";
var regionIdSQLVar = "@regionid";
var ownerIdSQLVar = "@ownerid";

exports.nameSQLVar = nameSQLVar;
exports.typeNameSQLVar = typeNameSQLVar;
exports.levelSQLVar = levelSQLVar;
exports.ownerSQLVar = ownerSQLVar;
exports.regionNameSQLVar = regionNameSQLVar;
exports.metadataSQLVar = metadataSQLVar;

exports.elementTypeIdSQLVar = elementTypeIdSQLVar;
exports.voltageIdSQLVar = voltageIdSQLVar;
exports.elementIdSQLVar = elementIdSQLVar;
exports.regionIdSQLVar = regionIdSQLVar;
exports.ownerIdSQLVar = ownerIdSQLVar;

exports.inputSQLVarNames = [nameSQLVar, typeNameSQLVar, levelSQLVar, ownerSQLVar, regionNameSQLVar, metadataSQLVar];
exports.outputSQLVarNames = [elementTypeIdSQLVar, voltageIdSQLVar, elementIdSQLVar, regionIdSQLVar, ownerIdSQLVar];

exports.tableColumnNames = tableAttributes;
exports.tableName = tableName;

exports.getAll1 = function (whereCols, whereOperators, whereValues, limit, offset, orderColumn, order, done, conn) {
    var tempConn = conn;
    if (conn == null) {
        tempConn = db.get();
    }
    var mainSql = "SELECT \
  * \
FROM \
  ( \
  SELECT \
    elements_ss_table.*, \
    voltages.level, \
    element_types.type, \
    element_owners.owner_names, \
    element_regions.region_names, \
    GROUP_CONCAT( \
      DISTINCT ss_table.name \
    ORDER BY \
      ss_table.name ASC SEPARATOR '-' \
    ) AS ss_names, \
    GROUP_CONCAT( \
      DISTINCT ss_table.ss_owner_names \
    ORDER BY \
      ss_table.ss_owner_names ASC SEPARATOR ',' \
    ) AS ss_owner_names, \
    GROUP_CONCAT( \
      DISTINCT ss_table.ss_region_names \
    ORDER BY \
      ss_table.ss_region_names ASC SEPARATOR ',' \
    ) AS ss_region_names, \
    GROUP_CONCAT( \
      DISTINCT ss_table.id \
    ORDER BY \
      ss_table.id ASC SEPARATOR '|||' \
    ) AS ss_ids \
  FROM \
    ( \
    SELECT \
      elements.*, \
      elements_has_substations.substations_id \
    FROM \
      elements \
    LEFT JOIN \
      elements_has_substations ON elements_has_substations.elements_id = elements.id \
  ) AS elements_ss_table \
LEFT JOIN \
  ( \
  SELECT \
    substations.id, \
    substations.elements_id, \
    elements.name, \
    elements.voltages_id, \
    elements.elem_num, \
    ss_owners.ss_owner_names, \
    ss_regions.ss_region_names \
  FROM \
    substations \
  INNER JOIN \
    elements ON substations.elements_id = elements.id \
  LEFT JOIN \
    ( \
    SELECT \
      elements_has_owners.elements_id, \
      GROUP_CONCAT( \
        DISTINCT owners.name \
      ORDER BY \
        owners.name ASC SEPARATOR ', ' \
      ) AS ss_owner_names \
    FROM \
      elements_has_owners \
    LEFT JOIN \
      owners ON owners.id = elements_has_owners.owners_id \
    GROUP BY \
      elements_id \
  ) AS ss_owners ON ss_owners.elements_id = substations.elements_id \
LEFT JOIN \
  ( \
  SELECT \
    elements_has_regions.elements_id, \
    GROUP_CONCAT( \
      DISTINCT regions.name \
    ORDER BY \
      regions.name ASC SEPARATOR ', ' \
    ) AS ss_region_names \
  FROM \
    elements_has_regions \
  LEFT JOIN \
    regions ON regions.id = elements_has_regions.regions_id \
  GROUP BY \
    elements_id \
) AS ss_regions ON ss_regions.elements_id = substations.elements_id \
) AS ss_table ON ss_table.id = elements_ss_table.substations_id \
LEFT JOIN \
  voltages ON voltages.id = elements_ss_table.voltages_id \
LEFT JOIN \
  element_types ON element_types.id = elements_ss_table.element_types_id \
LEFT JOIN \
  ( \
  SELECT \
    elements_has_owners.elements_id, \
    GROUP_CONCAT( \
      DISTINCT owners.name \
    ORDER BY \
      owners.name ASC SEPARATOR ', ' \
    ) AS owner_names \
  FROM \
    elements_has_owners \
  LEFT JOIN \
    owners ON owners.id = elements_has_owners.owners_id \
  GROUP BY \
    elements_id \
) AS element_owners ON element_owners.elements_id = elements_ss_table.id \
LEFT JOIN \
  ( \
  SELECT \
    elements_has_regions.elements_id, \
    GROUP_CONCAT( \
      DISTINCT regions.name \
    ORDER BY \
      regions.name ASC SEPARATOR ', ' \
    ) AS region_names \
  FROM \
    elements_has_regions \
  LEFT JOIN \
    regions ON regions.id = elements_has_regions.regions_id \
  GROUP BY \
    elements_id \
) AS element_regions ON element_regions.elements_id = elements_ss_table.id \
GROUP BY \
  elements_ss_table.id \
) AS elems_table";
    var values = [];
    var whereClause = "";
    if (whereCols.constructor === Array && whereCols.length > 0) {
        var whereSql = squel.expr();
        //if whereCols has both ss_names and name
        var ss_namesIndex = whereCols.indexOf("elems_table.ss_names");
        var nameIndex = whereCols.indexOf("elems_table.name");
        if (ss_namesIndex != -1 && nameIndex != -1) {
            //remove columns from the AND clause
            ss_namesIndex = whereCols.indexOf("elems_table.ss_names");
            var ss_nameCol = whereCols.splice(ss_namesIndex, 1)[0];
            var ss_nameOperator = whereOperators.splice(ss_namesIndex, 1)[0];
            var ss_nameValue = whereValues.splice(ss_namesIndex, 1)[0];
            nameIndex = whereCols.indexOf("elems_table.name");
            var nameCol = whereCols.splice(nameIndex, 1)[0];
            var nameOperator = whereOperators.splice(nameIndex, 1)[0];
            var nameValue = whereValues.splice(nameIndex, 1)[0];
            whereSql.and(squel.expr().or(vsprintf("%s %s ?", [ss_nameCol, ss_nameOperator]), ss_nameValue)
                .or(vsprintf("%s %s ?", [nameCol, nameOperator]), nameValue));

        }
        var ss_owner_namesIndex = whereCols.indexOf("elems_table.ss_owner_names");
        var owner_namesIndex = whereCols.indexOf("elems_table.owner_names");
        if (ss_owner_namesIndex != -1 && owner_namesIndex != -1) {
            //remove columns from the AND clause
            ss_owner_namesIndex = whereCols.indexOf("elems_table.ss_owner_names");
            var ss_owner_namesCol = whereCols.splice(ss_owner_namesIndex, 1)[0];
            var ss_owner_namesOperator = whereOperators.splice(ss_owner_namesIndex, 1)[0];
            var ss_owner_namesValue = whereValues.splice(ss_owner_namesIndex, 1)[0];
            owner_namesIndex = whereCols.indexOf("elems_table.owner_names");
            var owner_namesCol = whereCols.splice(owner_namesIndex, 1)[0];
            var owner_namesOperator = whereOperators.splice(owner_namesIndex, 1)[0];
            var owner_namesValue = whereValues.splice(owner_namesIndex, 1)[0];
            whereSql.and(squel.expr().or(vsprintf("%s %s ?", [ss_owner_namesCol, ss_owner_namesOperator]), ss_owner_namesValue)
                .or(vsprintf("%s %s ?", [owner_namesCol, owner_namesOperator]), owner_namesValue));
        }
        var ss_region_namesIndex = whereCols.indexOf("elems_table.ss_region_names");
        var region_namesIndex = whereCols.indexOf("elems_table.region_names");
        if (ss_region_namesIndex != -1 && region_namesIndex != -1) {
            //remove columns from the AND clause
            ss_region_namesIndex = whereCols.indexOf("elems_table.ss_region_names");
            var ss_region_namesCol = whereCols.splice(ss_region_namesIndex, 1)[0];
            var ss_region_namesOperator = whereOperators.splice(ss_region_namesIndex, 1)[0];
            var ss_region_namesValue = whereValues.splice(ss_region_namesIndex, 1)[0];
            region_namesIndex = whereCols.indexOf("elems_table.region_names");
            var region_namesCol = whereCols.splice(region_namesIndex, 1)[0];
            var region_namesOperator = whereOperators.splice(region_namesIndex, 1)[0];
            var region_namesValue = whereValues.splice(region_namesIndex, 1)[0];
            whereSql.and(squel.expr().or(vsprintf("%s %s ?", [ss_region_namesCol, ss_region_namesOperator]), ss_region_namesValue)
                .or(vsprintf("%s %s ?", [region_namesCol, region_namesOperator]), region_namesValue));
        }
        for (var i = 0; i < whereCols.length; i++) {
            var whereValue = whereValues[i];
            var whereOperator = whereOperators[i];
            if (whereOperator == "LIKE") {
                whereValue = "%" + whereValue + "%";
            }
            whereSql.and(whereCols[i] + " " + whereOperator + " " + "?", whereValue)
        }
        values = whereSql.toParam().values;
        whereClause = " WHERE (" + whereSql.toParam().text + ")";
    }
    if (orderColumn == null || orderColumn.trim() == "") {
        orderColumn = "elems_table.name";
    }
    if (order != "ASC" || order != "DESC") {
        order = "ASC";
    }

    var orderByClause = vsprintf(" ORDER BY %s %s", [orderColumn, order]);
    if (isNaN(limit)) {
        limit = 100;
    }
    if (isNaN(offset)) {
        offset = 100;
    }
    var limitClause = vsprintf(" LIMIT %s, %s;", [offset, limit]);
    var sqlString = mainSql + whereClause + orderByClause + limitClause;
    //console.log(sqlString);
    //console.log(values);
    tempConn.query(sqlString, values, function (err, rows) {
        if (err) return done(err);
        done(null, rows);
    });
};

exports.getAll = function (whereCols, whereOperators, whereValues, limit, offset, orderColumn, order, done, conn) {
    var tempConn = conn;
    if (conn == null) {
        tempConn = db.get();
    }
    var mainSql = "SELECT \
  elems_table.id, \
  elems_table.name, \
  elems_table.elem_num, \
  elems_table.type, \
  elems_table.description, \
  elems_table.level, \
  elems_table.el_owners_list, \
  elems_table.el_regions_list, \
  elems_table.el_states_list, \
  elems_table.ss_names_list, \
  elems_table.ss_owners_list, \
  elems_table.ss_regions_list, \
  elems_table.ss_states_list \
FROM \
  (SELECT \
     elements.*, \
     voltages.level, \
     element_types.type, \
     GROUP_CONCAT(DISTINCT owners1.name ORDER BY owners1.name ASC SEPARATOR '/')   AS el_owners_list, \
     GROUP_CONCAT(DISTINCT regions1.name ORDER BY regions1.name ASC SEPARATOR '/') AS el_regions_list, \
     GROUP_CONCAT(DISTINCT states1.name ORDER BY states1.name ASC SEPARATOR '/')   AS el_states_list, \
     GROUP_CONCAT(COALESCE(el_ss_info.el_regions_list, 'NA') ORDER BY el_ss_info.name ASC SEPARATOR \
                  '|||')                                                           AS ss_regions_list, \
     GROUP_CONCAT(COALESCE(el_ss_info.el_owners_list, 'NA') ORDER BY el_ss_info.name ASC SEPARATOR \
                  '|||')                                                           AS ss_owners_list, \
     GROUP_CONCAT(COALESCE(el_ss_info.el_states_list, 'NA') ORDER BY el_ss_info.name ASC SEPARATOR \
                  '|||')                                                           AS ss_states_list, \
     GROUP_CONCAT(COALESCE(el_ss_info.name, 'NA') ORDER BY el_ss_info.name ASC SEPARATOR \
                  '|||')                                                           AS ss_names_list, \
     GROUP_CONCAT(el_ss_info.el_name_with_owners ORDER BY el_ss_info.name ASC SEPARATOR \
                  '|||')                                                           AS ss_names_with_owners_list \
   FROM elements \
     LEFT OUTER JOIN voltages ON voltages.id = elements.voltages_id \
     LEFT OUTER JOIN element_types ON element_types.id = elements.element_types_id \
     LEFT OUTER JOIN ( \
                       SELECT \
                         elements_has_owners.*, \
                         owners.name \
                       FROM elements_has_owners \
                         LEFT OUTER JOIN owners ON owners.id = elements_has_owners.owners_id) \
       AS owners1 ON owners1.elements_id = elements.id \
     LEFT OUTER JOIN ( \
                       SELECT \
                         elements_has_regions.*, \
                         regions.name \
                       FROM elements_has_regions \
                         LEFT OUTER JOIN regions ON regions.id = elements_has_regions.regions_id) \
       AS regions1 ON regions1.elements_id = elements.id \
     LEFT OUTER JOIN ( \
                       SELECT \
                         elements_has_states.*, \
                         states.name \
                       FROM elements_has_states \
                         LEFT OUTER JOIN states ON states.id = elements_has_states.states_id) \
       AS states1 ON states1.elements_id = elements.id \
     LEFT OUTER JOIN \
     ( \
       SELECT \
         elements_has_substations.*, \
         ss_info.el_name_with_owners, \
         ss_info.el_regions_list, \
         ss_info.el_owners_list, \
         ss_info.el_states_list, \
         ss_info.name \
       FROM elements_has_substations \
         LEFT OUTER JOIN \
         ( \
           SELECT \
             substations.id, \
             el.name, \
             el.id                                                       AS ss_element_id, \
             el.el_regions_list, \
             el.el_owners_list, \
             el.el_states_list, \
             CONCAT(el.name, ' (', COALESCE(el.el_owners_list, ''), ')') AS el_name_with_owners \
           FROM substations \
             LEFT OUTER JOIN \
             (SELECT \
                elements.*, \
                GROUP_CONCAT(DISTINCT owners1.name ORDER BY owners1.name ASC SEPARATOR '/')   AS el_owners_list, \
                GROUP_CONCAT(DISTINCT regions1.name ORDER BY regions1.name ASC SEPARATOR '/') AS el_regions_list, \
                GROUP_CONCAT(DISTINCT states1.name ORDER BY states1.name ASC SEPARATOR '/')   AS el_states_list, \
                voltages.level \
              FROM elements \
                LEFT OUTER JOIN voltages ON voltages.id = elements.voltages_id \
                LEFT OUTER JOIN ( \
                                  SELECT \
                                    elements_has_owners.*, \
                                    owners.name \
                                  FROM elements_has_owners \
                                    LEFT OUTER JOIN owners ON owners.id = elements_has_owners.owners_id) \
                  AS owners1 ON owners1.elements_id = elements.id \
                LEFT OUTER JOIN ( \
                                  SELECT \
                                    elements_has_regions.*, \
                                    regions.name \
                                  FROM elements_has_regions \
                                    LEFT OUTER JOIN regions ON regions.id = elements_has_regions.regions_id) \
                  AS regions1 ON regions1.elements_id = elements.id \
                LEFT OUTER JOIN ( \
                                  SELECT \
                                    elements_has_states.*, \
                                    states.name \
                                  FROM elements_has_states \
                                    LEFT OUTER JOIN states ON states.id = elements_has_states.states_id) \
                  AS states1 ON states1.elements_id = elements.id \
              GROUP BY elements.id \
             ) AS el ON el.id = substations.elements_id \
           GROUP BY substations.id) AS ss_info ON ss_info.id = elements_has_substations.substations_id \
     ) AS el_ss_info ON el_ss_info.elements_id = elements.id \
   GROUP BY elements.id) AS elems_table";
    var values = [];
    var whereClause = "";
    if (whereCols.constructor === Array && whereCols.length > 0) {
        var whereSql = squel.expr();
        // if whereCols has both ss_names and name
        var ss_namesIndex = whereCols.indexOf("elems_table.ss_names_list");
        var nameIndex = whereCols.indexOf("elems_table.name");
        if (ss_namesIndex != -1 && nameIndex != -1) {
            //remove columns from the AND clause
            ss_namesIndex = whereCols.indexOf("elems_table.ss_names_list");
            var ss_nameCol = whereCols.splice(ss_namesIndex, 1)[0];
            var ss_nameOperator = whereOperators.splice(ss_namesIndex, 1)[0];
            var ss_nameValue = whereValues.splice(ss_namesIndex, 1)[0];
            nameIndex = whereCols.indexOf("elems_table.name");
            var nameCol = whereCols.splice(nameIndex, 1)[0];
            var nameOperator = whereOperators.splice(nameIndex, 1)[0];
            var nameValue = whereValues.splice(nameIndex, 1)[0];
            whereSql.and(squel.expr().or(vsprintf("%s %s ?", [ss_nameCol, ss_nameOperator]), ss_nameValue)
                .or(vsprintf("%s %s ?", [nameCol, nameOperator]), nameValue));

        }
        // if whereCols has both ss_owners_list and el_owners_list
        var ss_owner_namesIndex = whereCols.indexOf("elems_table.ss_owners_list");
        var owner_namesIndex = whereCols.indexOf("elems_table.el_owners_list");
        if (ss_owner_namesIndex != -1 && owner_namesIndex != -1) {
            //remove columns from the AND clause
            ss_owner_namesIndex = whereCols.indexOf("elems_table.ss_owners_list");
            var ss_owner_namesCol = whereCols.splice(ss_owner_namesIndex, 1)[0];
            var ss_owner_namesOperator = whereOperators.splice(ss_owner_namesIndex, 1)[0];
            var ss_owner_namesValue = whereValues.splice(ss_owner_namesIndex, 1)[0];
            owner_namesIndex = whereCols.indexOf("elems_table.el_owners_list");
            var owner_namesCol = whereCols.splice(owner_namesIndex, 1)[0];
            var owner_namesOperator = whereOperators.splice(owner_namesIndex, 1)[0];
            var owner_namesValue = whereValues.splice(owner_namesIndex, 1)[0];
            whereSql.and(squel.expr().or(vsprintf("%s %s ?", [ss_owner_namesCol, ss_owner_namesOperator]), ss_owner_namesValue)
                .or(vsprintf("%s %s ?", [owner_namesCol, owner_namesOperator]), owner_namesValue));
        }
        // if whereCols has both ss_regions_list and el_regions_list
        var ss_region_namesIndex = whereCols.indexOf("elems_table.ss_regions_list");
        var region_namesIndex = whereCols.indexOf("elems_table.el_regions_list");
        if (ss_region_namesIndex != -1 && region_namesIndex != -1) {
            //remove columns from the AND clause
            ss_region_namesIndex = whereCols.indexOf("elems_table.ss_regions_list");
            var ss_region_namesCol = whereCols.splice(ss_region_namesIndex, 1)[0];
            var ss_region_namesOperator = whereOperators.splice(ss_region_namesIndex, 1)[0];
            var ss_region_namesValue = whereValues.splice(ss_region_namesIndex, 1)[0];
            region_namesIndex = whereCols.indexOf("elems_table.el_regions_list");
            var region_namesCol = whereCols.splice(region_namesIndex, 1)[0];
            var region_namesOperator = whereOperators.splice(region_namesIndex, 1)[0];
            var region_namesValue = whereValues.splice(region_namesIndex, 1)[0];
            whereSql.and(squel.expr().or(vsprintf("%s %s ?", [ss_region_namesCol, ss_region_namesOperator]), ss_region_namesValue)
                .or(vsprintf("%s %s ?", [region_namesCol, region_namesOperator]), region_namesValue));
        }
        // if whereCols has both ss_states_list and el_states_list
        var ss_state_namesIndex = whereCols.indexOf("elems_table.ss_states_list");
        var state_namesIndex = whereCols.indexOf("elems_table.el_states_list");
        if (ss_state_namesIndex != -1 && state_namesIndex != -1) {
            //remove columns from the AND clause
            ss_state_namesIndex = whereCols.indexOf("elems_table.ss_states_list");
            var ss_state_namesCol = whereCols.splice(ss_state_namesIndex, 1)[0];
            var ss_state_namesOperator = whereOperators.splice(ss_state_namesIndex, 1)[0];
            var ss_state_namesValue = whereValues.splice(ss_state_namesIndex, 1)[0];
            state_namesIndex = whereCols.indexOf("elems_table.el_states_list");
            var state_namesCol = whereCols.splice(state_namesIndex, 1)[0];
            var state_namesOperator = whereOperators.splice(state_namesIndex, 1)[0];
            var state_namesValue = whereValues.splice(state_namesIndex, 1)[0];
            whereSql.and(squel.expr().or(vsprintf("%s %s ?", [ss_state_namesCol, ss_state_namesOperator]), ss_state_namesValue)
                .or(vsprintf("%s %s ?", [state_namesCol, state_namesOperator]), state_namesValue));
        }
        for (var i = 0; i < whereCols.length; i++) {
            var whereValue = whereValues[i];
            var whereOperator = whereOperators[i];
            if (whereOperator == "LIKE") {
                whereValue = "%" + whereValue + "%";
            }
            whereSql.and(whereCols[i] + " " + whereOperator + " " + "?", whereValue)
        }
        values = whereSql.toParam().values;
        whereClause = " WHERE (" + whereSql.toParam().text + ")";
    }
    if (orderColumn == null || orderColumn.trim() == "") {
        orderColumn = "elems_table.name";
    }
    if (order != "ASC" || order != "DESC") {
        order = "ASC";
    }

    var orderByClause = vsprintf(" ORDER BY %s %s", [orderColumn, order]);
    if (isNaN(limit)) {
        limit = 100;
    }
    if (isNaN(offset)) {
        offset = 100;
    }
    var limitClause = vsprintf(" LIMIT %s, %s;", [offset, limit]);
    var sqlString = mainSql + whereClause + orderByClause + limitClause;
    //console.log(sqlString);
    //console.log(values);
    tempConn.query(sqlString, values, function (err, rows) {
        if (err) return done(err);
        done(null, rows);
    });
};

exports.get = function (searchObj, done, conn) {
    var tempConn = conn;
    if (conn == null) {
        tempConn = db.get();
    }
    var sql = squel.select()
        .from(tableName);
    var expr = squel.expr();
    if (searchObj.ids != undefined && searchObj.ids != null && searchObj.ids.constructor === Array) {
        var ids = searchObj.ids;
        var idsExpr = squel.expr();
        for (var i = 0; i < ids.length; i++) {
            idsExpr.or(tableAttributes[0] + " = ?", ids[i]);
        }
        expr.and(idsExpr);
    }
    if (searchObj.names != undefined && searchObj.names != null && searchObj.names.constructor === Array) {
        var names = searchObj.names;
        var namesExpr = squel.expr();
        for (var i = 0; i < names.length; i++) {
            namesExpr.or(tableAttributes[1] + " = ?", names[i]);
        }
        expr.and(namesExpr);
    }
    if (searchObj.voltages != undefined && searchObj.voltages != null && searchObj.voltages.constructor === Array) {
        var voltages = searchObj.voltages;
        var voltagesExpr = squel.expr();
        for (var i = 0; i < voltages.length; i++) {
            voltagesExpr.or(tableAttributes[7] + " = ?", voltages[i]);
        }
        expr.and(voltagesExpr);
    }
    if (searchObj.elem_nums != undefined && searchObj.elem_nums != null && searchObj.elem_nums.constructor === Array) {
        var elem_nums = searchObj.elem_nums;
        var elem_numsExpr = squel.expr();
        for (var i = 0; i < elem_nums.length; i++) {
            elem_numsExpr.or(tableAttributes[8] + " = ?", elem_nums[i]);
        }
        expr.and(elem_numsExpr);
    }
    sql.where(expr);
    tempConn.query(sql.toParam().text, sql.toParam().values, function (err, rows) {
        if (err) return done(err);
        done(null, rows);
    });
};

var getById = exports.getById = function (id, done, conn) {
    var tempConn = conn;
    if (conn == null) {
        tempConn = db.get();
    }
    var sql = squel.select()
        .from(tableName);
    var expr = squel.expr();
    if (id != null) {
        expr.and(tableAttributes[0] + " = ?", id);
    }
    sql.where(expr);
    tempConn.query(sql.toParam().text, sql.toParam().values, function (err, rows) {
        if (err) return done(err);
        done(null, rows);
    });
};

exports.creationSQL = function () {
    var delimiter = ";";
    var createdSQL = "";

    createdSQL += "SET " + nameSQLVar + " = ?;";
    createdSQL += "SET " + typeNameSQLVar + " = ?;";
    createdSQL += "SET " + levelSQLVar + " = ?;";
    createdSQL += "SET " + ownerSQLVar + " = ?;";
    createdSQL += "SET " + regionNameSQLVar + " = ?;";
    createdSQL += "SET " + metadataSQLVar + " = ?;";

    createdSQL += NewSQLHelper.getSQLInsertIgnoreString(Element_type.tableName, [Element_type.tableColumnNames[1]], [typeNameSQLVar], "id", elementTypeIdSQLVar);
    createdSQL += delimiter;

    createdSQL += NewSQLHelper.getSQLInsertIgnoreString(Voltage.tableName, [Voltage.tableColumnNames[1]], [levelSQLVar], "id", voltageIdSQLVar);
    createdSQL += delimiter;

    createdSQL += NewSQLHelper.getSQLInsertIgnoreString(tableName, [tableAttributes[1], tableAttributes[6], tableAttributes[7]], [nameSQLVar, elementTypeIdSQLVar, voltageIdSQLVar], "id", elementIdSQLVar);
    createdSQL += delimiter;

    createdSQL += NewSQLHelper.getSQLInsertIgnoreString(Region.tableName, [Region.tableColumnNames[1]], [regionNameSQLVar], "id", regionIdSQLVar);
    createdSQL += delimiter;

    createdSQL += NewSQLHelper.getSQLInsertIgnoreString(Owner.tableName, [Owner.tableColumnNames[1], Owner.tableColumnNames[2], Owner.tableColumnNames[3]], [ownerSQLVar, metadataSQLVar, regionIdSQLVar], "id", ownerIdSQLVar, [Owner.tableColumnNames[1]], [ownerSQLVar]);
    createdSQL += delimiter;

    createdSQL += NewSQLHelper.getSQLInsertIgnoreString("elements_has_owners", ["elements_id", "owners_id"], [elementIdSQLVar, ownerIdSQLVar]);

    return createdSQL;
};

var creationSQL1 = function (elementNameSQLVar, elementDescriptionSQLVar, silSQLVar, stabilityLimitSQLVar, thermalLimitSQLVar, elementTypeNameSQLVar, elementTypeIdSQLVar, voltageSQLVar, voltageIdSQLVar, elementIdSQLVar, ownerNameSQLVars, ownerMetadataSQLVars, ownerRegionNameSQLVars, ownerRegionIdSQLVar, ownerIdSQLVar, elementRegionNamesSQLVars, elementRegionIdsSQLVar, stateNamesSQLVars, stateIdsSQLVar, substationNameSQLVars, substationVoltageSQLVars, replace) {
    var sql = "";
    var delimiter = ";";
    sql += NewSQLHelper.getSQLInsertIgnoreString(Element_type.tableName, [Element_type.tableColumnNames[1]], [elementTypeNameSQLVar], Element_type.tableColumnNames[0], elementTypeIdSQLVar);
    sql += delimiter;
    sql += NewSQLHelper.getSQLInsertIgnoreString(Voltage.tableName, [Voltage.tableColumnNames[1]], [voltageSQLVar], Voltage.tableColumnNames[0], voltageIdSQLVar);
    if (replace) {
        sql += delimiter;
        sql += NewSQLHelper.getSQLInsertReplaceString(tableName, tableAttributes.slice(1), [elementNameSQLVar, elementDescriptionSQLVar, silSQLVar, stabilityLimitSQLVar, thermalLimitSQLVar, elementTypeIdSQLVar, voltageIdSQLVar], tableAttributes[0], elementIdSQLVar);
    } else {
        sql += delimiter;
        sql += NewSQLHelper.getSQLInsertIgnoreString(tableName, tableAttributes.slice(1), [elementNameSQLVar, elementDescriptionSQLVar, silSQLVar, stabilityLimitSQLVar, thermalLimitSQLVar, elementTypeIdSQLVar, voltageIdSQLVar], tableAttributes[0], elementIdSQLVar, ["name", "element_types_id", "voltages_id"], [elementNameSQLVar, elementTypeIdSQLVar, voltageIdSQLVar]);
    }
    for (var i = 0; i < ownerNameSQLVars.length; i++) {
        sql += delimiter;
        sql += Owner.creationSQL(ownerNameSQLVars[i], ownerMetadataSQLVars[i], ownerRegionNameSQLVars[i], ownerRegionIdSQLVar, ownerIdSQLVar, false);
        sql += delimiter;
        sql += NewSQLHelper.getSQLInsertReplaceString("elements_has_owners", ["elements_id", "owners_id"], [elementIdSQLVar, ownerIdSQLVar]);
    }
    for (var i = 0; i < elementRegionNamesSQLVars.length; i++) {
        sql += delimiter;
        sql += NewSQLHelper.getSQLInsertIgnoreString(Region.tableName, [Region.tableColumnNames[1]], [elementRegionNamesSQLVars[i]], Region.tableColumnNames[0], elementRegionIdsSQLVar);
        sql += delimiter;
        sql += NewSQLHelper.getSQLInsertReplaceString("elements_has_regions", ["elements_id", "regions_id"], [elementIdSQLVar, elementRegionIdsSQLVar]);
    }
    for (var i = 0; i < stateNamesSQLVars.length; i++) {
        sql += delimiter;
        sql += NewSQLHelper.getSQLInsertIgnoreString(State.tableName, [State.tableColumnNames[1]], [stateNamesSQLVars[i]], State.tableColumnNames[0], stateIdsSQLVar);
        sql += delimiter;
        sql += NewSQLHelper.getSQLInsertReplaceString("elements_has_states", ["elements_id", "states_id"], [elementIdSQLVar, stateIdsSQLVar]);
    }

    if (substationNameSQLVars.length > 0) {
        sql += delimiter;
        var tempSSDescriptionSQLVar = "@tempSSDescription";
        sql += NewSQLHelper.setVariableSQLString(tempSSDescriptionSQLVar, "\"No Description\"");
        sql += delimiter;
        var tempSSsilSQLVar = "@tempSSSil";
        sql += NewSQLHelper.setVariableSQLString(tempSSsilSQLVar, "0");
        sql += delimiter;
        var tempSSstabilityLimitSQLVar = "@tempSSStabilityLimit";
        sql += NewSQLHelper.setVariableSQLString(tempSSstabilityLimitSQLVar, "0");
        sql += delimiter;
        var tempSSthermalLimitSQLVar = "@tempSSThermalLimit";
        sql += NewSQLHelper.setVariableSQLString(tempSSthermalLimitSQLVar, "0");
        sql += delimiter;
        var tempSSelementTypeNameSQLVar = "@tempSSTypeName";
        sql += NewSQLHelper.setVariableSQLString(tempSSelementTypeNameSQLVar, "\"Substation\"");
    }
    for (var i = 0; i < substationNameSQLVars.length; i++) {
        var tempSSsubstationIdSQLVar = "@tempSSSubstationId";
        sql += delimiter;
        sql += Substation.creationSQL(substationNameSQLVars[i], tempSSDescriptionSQLVar, tempSSsilSQLVar, tempSSstabilityLimitSQLVar, tempSSthermalLimitSQLVar, tempSSelementTypeNameSQLVar, "@tempSSTypeId", substationVoltageSQLVars[i], "@tempSSVoltageId", "@tempSSElementId", [], [], [], "@tempSSOwnerRegionId", "@tempSSOwnerId", [], "@tempSSElementRegionId", [], "@tempSSStateId", tempSSsubstationIdSQLVar, false);
        sql += delimiter;
        sql += NewSQLHelper.getSQLInsertReplaceString("elements_has_substations", ["elements_id", "substations_id"], [elementIdSQLVar, tempSSsubstationIdSQLVar]);
    }

    //console.log(sql);
    return sql;
};

var create = function (name, description, sil, stabilityLimit, thermalLimit, typeName, voltage, ownerNames, ownerMetadatas, ownerRegions, regions, states, substationNames, substationVoltages, done) {
    var values = [name, description, sil, stabilityLimit, thermalLimit, typeName, voltage];
    for (var i = 0; i < ownerNames.length; i++) {
        values.push(ownerNames[i]);
        values.push(ownerMetadatas[i]);
        values.push(ownerRegions[i]);
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

    var sql = "";
    var delimiter = ";";

    var elementIdSQLVar = "@elementId";

    var elementNameSQLVar = "@name";
    var elementDescriptionSQLVar = "@description";
    var silSQLVar = "@sil";
    var stabilityLimitSQLVar = "@stabilityLimit";
    var thermalLimitSQLVar = "@thermalLimit";
    var elementTypeNameSQLVar = "@typeName";
    var voltageSQLVar = "@voltage";
    var elementRegionNamesSQLVar = "@regionName";
    var stateNamesSQLVar = "@stateName";

    var ownerNameSQLVar = "@ownerName";
    var ownerMetadataSQLVar = "@ownerMetadata";
    var ownerRegionNameSQLVar = "@ownerRegion";

    var substationNameSQLVar = "@substationName";
    var substationVoltageSQLVar = "@substationVoltage";

    sql += "START TRANSACTION READ WRITE" + delimiter;

    sql += NewSQLHelper.setVariableSQLString(elementNameSQLVar, "?");
    sql += delimiter;
    sql += NewSQLHelper.setVariableSQLString(elementDescriptionSQLVar, "?");
    sql += delimiter;
    sql += NewSQLHelper.setVariableSQLString(silSQLVar, "?");
    sql += delimiter;
    sql += NewSQLHelper.setVariableSQLString(stabilityLimitSQLVar, "?");
    sql += delimiter;
    sql += NewSQLHelper.setVariableSQLString(thermalLimitSQLVar, "?");
    sql += delimiter;
    sql += NewSQLHelper.setVariableSQLString(elementTypeNameSQLVar, "?");
    sql += delimiter;
    sql += NewSQLHelper.setVariableSQLString(voltageSQLVar, "?");
    sql += delimiter;

    var ownerNameSQLVars = [];
    var ownerMetadataSQLVars = [];
    var ownerRegionNameSQLVars = [];
    for (var i = 0; i < ownerNames.length; i++) {
        ownerNameSQLVars[i] = ownerNameSQLVar + i;
        ownerMetadataSQLVars[i] = ownerMetadataSQLVar + i;
        ownerRegionNameSQLVars[i] = ownerRegionNameSQLVar + i;
        sql += NewSQLHelper.setVariableSQLString(ownerNameSQLVars[i], "?");
        sql += delimiter;
        sql += NewSQLHelper.setVariableSQLString(ownerMetadataSQLVars[i], "?");
        sql += delimiter;
        sql += NewSQLHelper.setVariableSQLString(ownerRegionNameSQLVars[i], "?");
        sql += delimiter;
    }

    var elementRegionNamesSQLVars = [];
    for (var i = 0; i < regions.length; i++) {
        elementRegionNamesSQLVars[i] = elementRegionNamesSQLVar + i;
        sql += NewSQLHelper.setVariableSQLString(elementRegionNamesSQLVars[i], "?");
        sql += delimiter;
    }

    var stateNamesSQLVars = [];
    for (var i = 0; i < states.length; i++) {
        stateNamesSQLVars[i] = stateNamesSQLVar + i;
        sql += NewSQLHelper.setVariableSQLString(stateNamesSQLVars[i], "?");
        sql += delimiter;
    }

    var substationNameSQLVars = [];
    var substationVoltageSQLVars = [];
    for (var i = 0; i < substationNames.length; i++) {
        substationNameSQLVars[i] = substationNameSQLVar + i;
        sql += NewSQLHelper.setVariableSQLString(substationNameSQLVars[i], "?");
        sql += delimiter;
        substationVoltageSQLVars[i] = substationVoltageSQLVar + i;
        sql += NewSQLHelper.setVariableSQLString(substationVoltageSQLVars[i], "?");
        sql += delimiter;
    }

    sql += creationSQL1(elementNameSQLVar, elementDescriptionSQLVar, silSQLVar, stabilityLimitSQLVar, thermalLimitSQLVar, elementTypeNameSQLVar, "@typeId", voltageSQLVar, "@voltageId", elementIdSQLVar, ownerNameSQLVars, ownerMetadataSQLVars, ownerRegionNameSQLVars, "@ownerRegionId", "@ownerId", elementRegionNamesSQLVars, "@regionId", stateNamesSQLVars, "@stateId", substationNameSQLVars, substationVoltageSQLVars, true);
    sql += delimiter;
    sql += "COMMIT" + delimiter;
    sql += "SELECT " + elementIdSQLVar + " AS elementId" + delimiter;
    console.log(sql + "\n\n\n");
    db.get().query(sql, values, function (err, rows) {
        if (err) return done(err);
        console.log(JSON.stringify(rows));
        done(null, rows);
    });
};

exports.elementSubstationCreate = function (substationNames, substationVoltages, elementIds, done) {
    var sql = "";
    var delimiter = ";";
    var values = [];
    sql += "START TRANSACTION READ WRITE;";
    for (var i = 0; i < substationNames.length; i++) {
        sql += "SET @subId = (SELECT substations.id FROM elements LEFT OUTER JOIN substations ON substations.elements_id = elements.id LEFT OUTER JOIN voltages ON voltages.id = elements.voltages_id WHERE elements.name = ? AND voltages.level = ?);"
        sql += NewSQLHelper.getSQLInsertReplaceString("elements_has_substations", ["elements_id", "substations_id"], ["?", "@subId"]);
        sql += delimiter;
        values.push(substationNames[i], substationVoltages[i], elementIds[i]);
    }
    sql += "COMMIT";
    console.log(sql + "\n\n\n");
    db.get().query(sql, values, function (err, rows) {
        if (err) return done(err);
        console.log(JSON.stringify(rows));
        done(null, rows);
    });
};

var plainCreate = exports.plainCreate = function (name, description, sil, stabilityLimit, thermalLimit, typeId, voltageId, elem_num, done, conn) {
    var tempConn = conn;
    if (conn == null) {
        tempConn = db.get();
    }
    var sql = squel.insert()
        .into(tableName)
        .set(tableAttributes[1], name)
        .set(tableAttributes[2], description)
        .set(tableAttributes[3], sil)
        .set(tableAttributes[4], stabilityLimit)
        .set(tableAttributes[5], thermalLimit)
        .set(tableAttributes[6], typeId)
        .set(tableAttributes[7], voltageId)
        .set(tableAttributes[8], elem_num);
    var query = sql.toParam().text;
    query += " ON DUPLICATE KEY UPDATE name = name;";
    //(name,element_types_id, voltages_id) is unique
    var getSql = squel.select()
        .from(tableName)
        .where(
        squel.expr()
            .and(tableAttributes[1] + " = ?", name)
            .and(tableAttributes[6] + " = ?", typeId)
            .and(tableAttributes[7] + " = ?", voltageId)
            .and(tableAttributes[8] + " = ?", elem_num)
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

var getWithCreationWithoutTransaction = exports.getWithCreationWithoutTransaction = function (name, description, sil, stabilityLimit, thermalLimit, typeName, voltage, elem_num, ownerNames, ownerMetadatas, ownerRegions, regions, states, substationNames, substationVoltages, done, conn) {
    var tempConn = conn;
    if (conn == null) {
        tempConn = db.get();
    }
    var tempResults = {
        ownerIds: [],
        regionIds: [],
        stateIds: [],
        substationIds: [],
        voltageId: null,
        typeId: null,
        elementId: null,
        elements: []
    };

    // create voltage and get the voltage id
    var getVoltageId = function (callback) {
        Voltage.getByLevelWithCreation(voltage, function (err, rows) {
            if (err) return callback(err);
            var voltageId = rows[0].id;
            tempResults.voltageId = voltageId;
            callback(null, tempResults);
        }, tempConn);
    };

    // create element type and get the elementType id
    var getElementTypeId = function (prevRes, callback) {
        Element_type.getByTypeWithCreation(typeName, function (err, rows) {
            if (err) return callback(err);
            var typeId = rows[0].id;
            tempResults.typeId = typeId;
            prevRes.typeId = typeId;
            callback(null, prevRes);
        }, tempConn);
    };

    // create element and get the element id
    var getElementId = function (prevRes, callback) {
        plainCreate(name, description, sil, stabilityLimit, thermalLimit, prevRes.typeId, prevRes.voltageId, elem_num, function (err, rows) {
            if (err) return callback(err);
            var elementId = rows[0].id;
            tempResults.elementId = elementId;
            tempResults.elements = rows;
            prevRes.elementId = elementId;
            prevRes.elements = rows;
            callback(null, prevRes);
        }, tempConn);
    };

    // get all the ownerIds. Returns the ownerIds Array
    var getOwnerIds = function (prevRes, callback) {
        //todo check if ownerNames is an Array
        var ownerIterators = Array.apply(null, {length: ownerNames.length}).map(Function.call, Number);
        var getOwnerId = function (ownerIterator, callback) {
            Owner.getByNameWithCreation(ownerNames[ownerIterator], ownerMetadatas[ownerIterator], ownerRegions[ownerIterator], function (err, rows) {
                if (err) {
                    return callback(err);
                }
                var ownerId = rows[0].id;
                callback(null, ownerId);
            }, tempConn);
        };
        //finding each owner Id
        async.mapSeries(ownerIterators, getOwnerId, function (err, results) {
            if (err) return callback(err);
            var ownerIds = results;
            tempResults.ownerIds = ownerIds;
            prevRes.ownerIds = ownerIds;
            callback(null, prevRes);
        });
    };

    //create entries in elements_has_owners
    var createElementsHasOwners = function (prevRes, callback) {
        var ownerIterators = Array.apply(null, {length: prevRes.ownerIds.length}).map(Function.call, Number);
        var createElementOwnerRelation = function (ownerIterator, callback) {
            Element_Owner.getWithCreation(prevRes.elementId, prevRes.ownerIds[ownerIterator], function (err, rows) {
                if (err) {
                    return callback(err);
                }
                callback(null, rows[0]);
            }, tempConn);
        };
        //creating each owner element relation
        async.mapSeries(ownerIterators, createElementOwnerRelation, function (err, results) {
            if (err) return callback(err);
            callback(null, prevRes);
        });
    };

    // get all the regionIds. Returns the regionIds Array
    var getRegionIds = function (prevRes, callback) {
        //todo check if regions is an Array
        var regionIterators = Array.apply(null, {length: regions.length}).map(Function.call, Number);
        var getRegionId = function (regionIterator, callback) {
            Region.getByNameWithCreation(regions[regionIterator], function (err, rows) {
                if (err) {
                    return callback(err);
                }
                var regionId = rows[0].id;
                callback(null, regionId);
            }, tempConn);
        };
        //finding each region Id
        async.mapSeries(regionIterators, getRegionId, function (err, results) {
            if (err) return callback(err);
            var regionIds = results;
            tempResults.regionIds = regionIds;
            prevRes.regionIds = regionIds;
            callback(null, prevRes);
        });
    };

    //create entries in elements_has_regions
    var createElementsHasRegions = function (prevRes, callback) {
        var regionIterators = Array.apply(null, {length: prevRes.regionIds.length}).map(Function.call, Number);
        var createElementRegionRelation = function (regionIterator, callback) {
            Element_Region.getWithCreation(prevRes.elementId, prevRes.regionIds[regionIterator], function (err, rows) {
                if (err) {
                    return callback(err);
                }
                callback(null, rows[0]);
            }, tempConn);
        };
        //creating each region element relation
        async.mapSeries(regionIterators, createElementRegionRelation, function (err, results) {
            if (err) return callback(err);
            callback(null, prevRes);
        });
    };

    // get all the stateIds. Returns the stateIds Array
    var getStateIds = function (prevRes, callback) {
        //todo check if states is an Array
        var stateIterators = Array.apply(null, {length: states.length}).map(Function.call, Number);
        var getStateId = function (stateIterator, callback) {
            State.getByNameWithCreation(states[stateIterator], function (err, rows) {
                if (err) {
                    return callback(err);
                }
                var stateId = rows[0].id;
                callback(null, stateId);
            }, tempConn);
        };
        //finding each state Id
        async.mapSeries(stateIterators, getStateId, function (err, results) {
            if (err) return callback(err);
            var stateIds = results;
            tempResults.stateIds = stateIds;
            prevRes.stateIds = stateIds;
            callback(null, prevRes);
        });
    };

    //create entries in elements_has_states
    var createElementsHasStates = function (prevRes, callback) {
        var stateIterators = Array.apply(null, {length: prevRes.stateIds.length}).map(Function.call, Number);
        var createElementStateRelation = function (regionIterator, callback) {
            Element_State.getWithCreation(prevRes.elementId, prevRes.stateIds[regionIterator], function (err, rows) {
                if (err) {
                    return callback(err);
                }
                callback(null, rows[0]);
            }, tempConn);
        };
        //creating each region element relation
        async.mapSeries(stateIterators, createElementStateRelation, function (err, results) {
            if (err) return callback(err);
            callback(null, prevRes);
        });
    };

    // get Substation Ids
    var getSubstationIds = function (prevRes, callback) {
        //todo check if substationNames is an Array and substationNames and substationVoltages have same length
        var substationIterators = Array.apply(null, {length: substationNames.length}).map(Function.call, Number);
        var getSubstationId = function (substationIterator, callback) {
            Substation.getWithCreation(substationNames[substationIterator], substationNames[substationIterator], substationVoltages[substationIterator], [], [], [], function (err, rows) {
                if (err) {
                    return callback(err);
                }
                var substationId = rows[0].id;
                callback(null, substationId);
            }, tempConn);
        };
        //finding each substation Id
        async.mapSeries(substationIterators, getSubstationId, function (err, results) {
            if (err) return callback(err);
            var substationIds = results;
            tempResults.substationIds = substationIds;
            prevRes.substationIds = substationIds;
            callback(null, prevRes);
        });
    };

    //create entries in elements_has_substations
    var createElementsHasSubstations = function (prevRes, callback) {
        var substationIterators = Array.apply(null, {length: prevRes.substationIds.length}).map(Function.call, Number);
        var createElementSubstationRelation = function (substationIterator, callback) {
            Element_Substation.getWithCreation(prevRes.elementId, prevRes.substationIds[substationIterator], function (err, rows) {
                if (err) {
                    return callback(err);
                }
                callback(null, rows[0]);
            }, tempConn);
        };
        //creating each substation element relation
        async.mapSeries(substationIterators, createElementSubstationRelation, function (err, results) {
            if (err) return callback(err);
            callback(null, prevRes);
        });
    };

    var functionsArray = [getVoltageId, getElementTypeId, getElementId, getOwnerIds, createElementsHasOwners, getRegionIds, createElementsHasRegions, getStateIds, createElementsHasStates, getSubstationIds, createElementsHasSubstations];
    async.waterfall(functionsArray, function (err, prevRes) {
        if (err) return done(err);
        console.log("From Element creation********************");
        console.log(prevRes);
        done(null, prevRes.elements);
    });
};

exports.getWithCreation = function (name, description, sil, stabilityLimit, thermalLimit, typeName, voltage, elem_num, ownerNames, ownerMetadatas, ownerRegions, regions, states, substationNames, substationVoltages, done, conn) {
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
                getWithCreationWithoutTransaction(name, description, sil, stabilityLimit, thermalLimit, typeName, voltage, elem_num, ownerNames, ownerMetadatas, ownerRegions, regions, states, substationNames, substationVoltages, function (err, rows) {
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
        getWithCreationWithoutTransaction(name, description, sil, stabilityLimit, thermalLimit, typeName, voltage, elem_num, ownerNames, ownerMetadatas, ownerRegions, regions, states, substationNames, substationVoltages, function (err, rows) {
            if (err) return done(err);
            done(null, rows);
        }, tempConn);
    }
};

exports.creationSQL1 = creationSQL1;
exports.create = create;
