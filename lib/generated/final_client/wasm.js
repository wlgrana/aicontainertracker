
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.18.0
 * Query Engine version: 4c784e32044a8a016d99474bd02a3b6123742169
 */
Prisma.prismaVersion = {
  client: "5.18.0",
  engine: "4c784e32044a8a016d99474bd02a3b6123742169"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}

/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.ImportLogScalarFieldEnum = {
  fileName: 'fileName',
  fileURL: 'fileURL',
  importedBy: 'importedBy',
  importedOn: 'importedOn',
  rowsProcessed: 'rowsProcessed',
  rowsSucceeded: 'rowsSucceeded',
  rowsFailed: 'rowsFailed',
  carrierFormatId: 'carrierFormatId',
  importType: 'importType',
  status: 'status',
  errorLog: 'errorLog',
  aiAnalysis: 'aiAnalysis',
  aiAnalyzedAt: 'aiAnalyzedAt'
};

exports.Prisma.RawRowScalarFieldEnum = {
  id: 'id',
  importLogId: 'importLogId',
  rowNumber: 'rowNumber',
  data: 'data'
};

exports.Prisma.TransitStageScalarFieldEnum = {
  stageName: 'stageName',
  stageCode: 'stageCode',
  sequence: 'sequence',
  category: 'category',
  expectedDays: 'expectedDays',
  alertAfterDays: 'alertAfterDays',
  responsibleTeam: 'responsibleTeam',
  isActive: 'isActive',
  dcsaEventType: 'dcsaEventType',
  dcsaEventCategory: 'dcsaEventCategory',
  dcsaFacilityType: 'dcsaFacilityType'
};

exports.Prisma.ShipmentScalarFieldEnum = {
  shipmentReference: 'shipmentReference',
  hbl: 'hbl',
  mbl: 'mbl',
  bookingReference: 'bookingReference',
  shipmentType: 'shipmentType',
  carrier: 'carrier',
  forwarder: 'forwarder',
  shipper: 'shipper',
  consignee: 'consignee',
  pol: 'pol',
  pod: 'pod',
  finalDestination: 'finalDestination',
  contents: 'contents',
  supplier: 'supplier',
  totalWeight: 'totalWeight',
  totalPieces: 'totalPieces',
  customerReference: 'customerReference',
  poNumber: 'poNumber',
  incoTerms: 'incoTerms',
  expectedContainers: 'expectedContainers',
  blType: 'blType',
  blStatus: 'blStatus',
  paymentStatus: 'paymentStatus',
  paymentDueDate: 'paymentDueDate',
  amountDue: 'amountDue',
  releaseStatus: 'releaseStatus',
  releaseDate: 'releaseDate',
  holdReason: 'holdReason',
  notes: 'notes',
  aceEntryNumber: 'aceEntryNumber',
  aceEntryType: 'aceEntryType',
  dutyAmount: 'dutyAmount',
  liquidationStatus: 'liquidationStatus',
  liquidationDate: 'liquidationDate'
};

exports.Prisma.ContainerScalarFieldEnum = {
  containerNumber: 'containerNumber',
  containerType: 'containerType',
  currentStatus: 'currentStatus',
  currentLocation: 'currentLocation',
  currentVessel: 'currentVessel',
  currentVoyage: 'currentVoyage',
  mbl: 'mbl',
  carrier: 'carrier',
  pol: 'pol',
  pod: 'pod',
  etd: 'etd',
  atd: 'atd',
  eta: 'eta',
  ata: 'ata',
  lastFreeDay: 'lastFreeDay',
  detentionFreeDay: 'detentionFreeDay',
  statusLastUpdated: 'statusLastUpdated',
  hasException: 'hasException',
  exceptionType: 'exceptionType',
  exceptionOwner: 'exceptionOwner',
  exceptionNotes: 'exceptionNotes',
  exceptionDate: 'exceptionDate',
  manualPriority: 'manualPriority',
  priorityReason: 'priorityReason',
  prioritySetBy: 'prioritySetBy',
  prioritySetDate: 'prioritySetDate',
  notes: 'notes',
  emptyIndicator: 'emptyIndicator',
  sealNumber: 'sealNumber',
  grossWeight: 'grossWeight',
  carrierEventId: 'carrierEventId',
  aceEntryNumber: 'aceEntryNumber',
  aceDisposition: 'aceDisposition',
  aceStatus: 'aceStatus',
  aceLastUpdated: 'aceLastUpdated',
  pgaHold: 'pgaHold',
  pgaAgency: 'pgaAgency',
  pgaHoldReason: 'pgaHoldReason',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ShipmentContainerScalarFieldEnum = {
  id: 'id',
  shipmentId: 'shipmentId',
  containerId: 'containerId',
  piecesInContainer: 'piecesInContainer',
  weightInContainer: 'weightInContainer',
  notes: 'notes'
};

exports.Prisma.ContainerEventScalarFieldEnum = {
  id: 'id',
  containerId: 'containerId',
  stageName: 'stageName',
  eventDateTime: 'eventDateTime',
  location: 'location',
  facilityId: 'facilityId',
  vessel: 'vessel',
  voyage: 'voyage',
  source: 'source',
  sourceFileId: 'sourceFileId',
  updatedBy: 'updatedBy',
  updatedOn: 'updatedOn',
  previousStatus: 'previousStatus',
  exceptionCleared: 'exceptionCleared',
  notes: 'notes',
  eventCategory: 'eventCategory',
  eventClassifier: 'eventClassifier',
  dcsaEventType: 'dcsaEventType',
  transportMode: 'transportMode',
  facilityType: 'facilityType',
  emptyIndicator: 'emptyIndicator',
  carrierEventId: 'carrierEventId'
};

exports.Prisma.ShipmentEventScalarFieldEnum = {
  id: 'id',
  shipmentId: 'shipmentId',
  eventType: 'eventType',
  eventDateTime: 'eventDateTime',
  documentType: 'documentType',
  source: 'source',
  sourceFileId: 'sourceFileId',
  updatedBy: 'updatedBy',
  updatedOn: 'updatedOn',
  previousBLStatus: 'previousBLStatus',
  newBLStatus: 'newBLStatus',
  notes: 'notes',
  dcsaEventType: 'dcsaEventType',
  carrierEventId: 'carrierEventId'
};

exports.Prisma.ACEStatusLogScalarFieldEnum = {
  id: 'id',
  containerId: 'containerId',
  shipmentId: 'shipmentId',
  aceDisposition: 'aceDisposition',
  aceStatus: 'aceStatus',
  previousACEStatus: 'previousACEStatus',
  holdType: 'holdType',
  pgaAgency: 'pgaAgency',
  holdReason: 'holdReason',
  eventDateTime: 'eventDateTime',
  source: 'source',
  sourceFileId: 'sourceFileId',
  updatedOn: 'updatedOn',
  notes: 'notes'
};

exports.Prisma.FacilityScalarFieldEnum = {
  facilityName: 'facilityName',
  facilityCode: 'facilityCode',
  facilityType: 'facilityType',
  portId: 'portId',
  address: 'address',
  unLocationCode: 'unLocationCode',
  isActive: 'isActive'
};

exports.Prisma.CarrierScalarFieldEnum = {
  carrierName: 'carrierName',
  scac: 'scac',
  shortName: 'shortName',
  trackingURL: 'trackingURL',
  isActive: 'isActive',
  dcsaCompliant: 'dcsaCompliant',
  apiEndpoint: 'apiEndpoint',
  apiCredentialRef: 'apiCredentialRef'
};

exports.Prisma.PortScalarFieldEnum = {
  portName: 'portName',
  portCode: 'portCode',
  country: 'country',
  countryCode: 'countryCode',
  region: 'region',
  defaultFreeDays: 'defaultFreeDays',
  isActive: 'isActive',
  acePortCode: 'acePortCode',
  cbpDistrict: 'cbpDistrict'
};

exports.Prisma.ForwarderScalarFieldEnum = {
  forwarderName: 'forwarderName',
  shortName: 'shortName',
  contactName: 'contactName',
  contactEmail: 'contactEmail',
  contactPhone: 'contactPhone',
  address: 'address',
  notes: 'notes',
  isActive: 'isActive',
  customsBroker: 'customsBroker',
  aceFilerCode: 'aceFilerCode'
};

exports.Prisma.DemurrageRateScalarFieldEnum = {
  name: 'name',
  carrierId: 'carrierId',
  portId: 'portId',
  containerType: 'containerType',
  freeDays: 'freeDays',
  dailyRate: 'dailyRate',
  effectiveFrom: 'effectiveFrom',
  effectiveTo: 'effectiveTo',
  notes: 'notes'
};

exports.Prisma.CarrierFormatScalarFieldEnum = {
  formatName: 'formatName',
  carrierId: 'carrierId',
  formatType: 'formatType',
  columnMapping: 'columnMapping',
  sampleHeaders: 'sampleHeaders',
  isActive: 'isActive',
  notes: 'notes'
};

exports.Prisma.DCSAEventMapScalarFieldEnum = {
  name: 'name',
  carrierId: 'carrierId',
  sourceEventCode: 'sourceEventCode',
  sourceEventName: 'sourceEventName',
  dcsaEventType: 'dcsaEventType',
  transitStageName: 'transitStageName',
  eventCategory: 'eventCategory',
  notes: 'notes',
  isActive: 'isActive'
};

exports.Prisma.AttentionFlagScalarFieldEnum = {
  id: 'id',
  containerId: 'containerId',
  reason: 'reason',
  priority: 'priority',
  flaggedBy: 'flaggedBy',
  flaggedOn: 'flaggedOn',
  owner: 'owner',
  notes: 'notes',
  resolved: 'resolved',
  resolvedBy: 'resolvedBy',
  resolvedDate: 'resolvedDate',
  resolutionNote: 'resolutionNote'
};

exports.Prisma.ActivityLogScalarFieldEnum = {
  id: 'id',
  containerId: 'containerId',
  shipmentId: 'shipmentId',
  action: 'action',
  actor: 'actor',
  detail: 'detail',
  source: 'source',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.StatusOverrideScalarFieldEnum = {
  id: 'id',
  containerNumber: 'containerNumber',
  previousStatus: 'previousStatus',
  newStatus: 'newStatus',
  reason: 'reason',
  overriddenBy: 'overriddenBy',
  overriddenAt: 'overriddenAt'
};

exports.Prisma.RiskAssessmentScalarFieldEnum = {
  id: 'id',
  containerId: 'containerId',
  riskScore: 'riskScore',
  riskFactors: 'riskFactors',
  recommendations: 'recommendations',
  lastUpdated: 'lastUpdated'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  ImportLog: 'ImportLog',
  RawRow: 'RawRow',
  TransitStage: 'TransitStage',
  Shipment: 'Shipment',
  Container: 'Container',
  ShipmentContainer: 'ShipmentContainer',
  ContainerEvent: 'ContainerEvent',
  ShipmentEvent: 'ShipmentEvent',
  ACEStatusLog: 'ACEStatusLog',
  Facility: 'Facility',
  Carrier: 'Carrier',
  Port: 'Port',
  Forwarder: 'Forwarder',
  DemurrageRate: 'DemurrageRate',
  CarrierFormat: 'CarrierFormat',
  DCSAEventMap: 'DCSAEventMap',
  AttentionFlag: 'AttentionFlag',
  ActivityLog: 'ActivityLog',
  StatusOverride: 'StatusOverride',
  RiskAssessment: 'RiskAssessment'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
