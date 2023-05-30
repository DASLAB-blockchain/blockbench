//
//  ycsbc.cc
//  YCSB-C
//
//  Created by Jinglei Ren on 12/19/14.
//  Copyright (c) 2014 Jinglei Ren <jinglei@ren.systems>.
//

#include <cstring>
#include <string>
#include <iostream>
#include <vector>
#include <future>
#include <atomic>
#include <sstream>
#include "core/utils.h"
#include "core/timer.h"
#include "core/client.h"
#include "core/core_workload.h"
#include "db/db_factory.h"
#include "db/evm_db.h"
#include "db/hyperledger_db.h"
using namespace std;

const unsigned int BLOCK_POLLING_INTERVAL = 1;
const unsigned int CONFIRM_BLOCK_LENGTH = 5;
const unsigned int HL_CONFIRM_BLOCK_LENGTH = 1;
const unsigned int PARITY_CONFIRM_BLOCK_LENGTH = 1;

std::unordered_map<string, double> pendingtx;

// Define structure to maintain stat for each txn
struct txn_stat {
  long latencyNs;
  int txnId;
  txn_stat(long latencyNs, int txnId) {
    this->latencyNs = latencyNs;
    this->txnId = txnId;
  };
};

// Sort by txn id
struct txn_stat_cmp {
  bool operator() (const txn_stat &l, const txn_stat &r) {
    return l.txnId < r.txnId;
  };
};

std::vector<txn_stat> txn_stat_list;
// locking the pendingtx queue
SpinLock txlock;

void UsageMessage(const char *command);
bool StrStartWith(const char *str, const char *pre);
string ParseCommandLine(int argc, const char *argv[], utils::Properties &props);


int SingleClientTxn(ycsbc::Client &client, bool is_loading, int txnId) {
  int res = 0;
    if (is_loading) {
      res = client.DoInsert();
    } else {
      long txn_start_time = utils::time_now();
      // Measure the transaction time in ns
      res = client.DoTransaction();
      long latency = utils::time_now() - txn_start_time;
      // Only append when success
      if (res == 1) {
        txlock.lock();
        txn_stat_list.push_back(txn_stat(latency, txnId));
        txlock.unlock();
      }
    }
    return res;
}

// Used for data loading
int DelegateClientLoading(ycsbc::DB *db, ycsbc::CoreWorkload *wl, const int num_ops,
                   bool is_loading, const int txrate) {
  db->Init();
  ycsbc::Client client(*db, *wl);
  int oks = 0;
  for (int i = 0; i < num_ops; ++i) {
    oks += SingleClientTxn(client, is_loading, i);
  }
  db->Close();
  return oks;
}

// Used for executing workload
int DelegateClient(ycsbc::DB *db, ycsbc::CoreWorkload *wl, const int num_ops,
                   bool is_loading, const int txrate) {
  db->Init();
  ycsbc::Client client(*db, *wl);
  int oks = 0;
  double tx_sleep_time = 1.0 / txrate;
  vector<future<int>> txns;
  for (int i = 0; i < num_ops; ++i) {
    txns.emplace_back(async(launch::async, SingleClientTxn, 
                    std::ref(client), is_loading, i));
    utils::sleep(tx_sleep_time);
  }
  for (auto &n: txns) {
    oks += n.get();
  }
  db->Close();
  return oks;
}

// wakeup every interval second to poll,
// when first started, the block height is start_block_height
int StatusThread(string dbname, ycsbc::DB *db, double interval,
                 int start_block_height,
                 std::atomic_bool &stop) {
  int cur_block_height = start_block_height;

  long start_time;
  long end_time;
  int txcount = 0;
  long latency;
  int confirm_duration = 1;
  if (dbname == "ethereum")
    confirm_duration = CONFIRM_BLOCK_LENGTH;
  else if (dbname == "parity")
    confirm_duration = PARITY_CONFIRM_BLOCK_LENGTH;
  else
    confirm_duration = HL_CONFIRM_BLOCK_LENGTH;

  while (!stop) {
    start_time = utils::time_now();
    int tip = db->GetTip();
    if (tip == -1)  // fail
      utils::sleep(interval);

    while (cur_block_height + confirm_duration <= tip) {
      vector<string> txs = db->PollTxn(cur_block_height);
      // cout << "polled block " << cur_block_height << " : " << txs.size()
          //  << " txs " << endl;
      cur_block_height++;
      // This is a timestamp in ns
      long block_time = utils::time_now();
      txlock.lock();
      for (string tmp : txs) {
        string s = (dbname == "ethereum" || dbname == "parity")
                       ? tmp.substr(1, tmp.length() - 2)  // get rid of ""
                       : tmp;
        if (pendingtx.find(s) != pendingtx.end()) {
          txcount++;
          latency += (block_time - pendingtx[s]);
          // then remove
          pendingtx.erase(s);
        }
      }
      txlock.unlock();
    }

    // Print average latency for different transactions
    // cout << "In the last " << interval << "s, finish_tx count = " << txcount << endl;

    // Let's print the current transaction latency

    txcount = 0;
    latency = 0;

    end_time = utils::time_now();

    // 2. Get all tx from cur_block_height until tip-CONFIRM_BLOCK_LENGTH
    // 3. Process the tx, update the stats
    // 4. Sleep for INTERVAL - (time taken to do 1-3)

    // sleep in nanosecond
    utils::sleep(interval - (end_time - start_time) / 1000000000.0);
    // std::this_thread::sleep_for(std::chrono::seconds(5));
  }
  return 0;
}

void displayLatency() {
  std::cout << "Finish in total " << txn_stat_list.size() << " txns in the workload" << std::endl;
  for (auto stat: txn_stat_list) {
    std::cout << stat.latencyNs / 1e9 << " ";
  }
  std::cout << std::endl;
}

void displaySuccessTxnId() {
  std::cout << "Following as succeed txn Id" << std::endl;
  sort(txn_stat_list.begin(), txn_stat_list.end(), txn_stat_cmp());
  for (auto stat: txn_stat_list) {
    std::cout << stat.txnId << " ";
  }
  std::cout << std::endl;
}

int main(const int argc, const char *argv[]) {
  utils::Properties props;
  string file_name = ParseCommandLine(argc, argv, props);

  ycsbc::DB *db = ycsbc::DBFactory::CreateDB(props);
  if (!db) {
    cout << "Unknown database name " << props["dbname"] << endl;
    exit(0);
  }

  int current_tip = db->GetTip();
  db->Init(&pendingtx, &txlock);

  cout << "Current TIP = " << current_tip << endl;
  ycsbc::CoreWorkload wl;
  wl.Init(props);

  const int num_threads = stoi(props.GetProperty("threadcount", "1"));
  const int txrate = stoi(props.GetProperty("txrate", "10"));


  // Launch the status_thread
  std::atomic_bool status_thread_stop(false); 
  auto status_thread_async = async(launch::async, StatusThread, props["dbname"],
                               db, BLOCK_POLLING_INTERVAL, current_tip, std::ref(status_thread_stop));

  long loading_start_time = utils::time_now();
  cout << "Start data loading.." << endl;
  // Loads data
  vector<future<int>> actual_ops;
  int total_ops = stoi(props[ycsbc::CoreWorkload::RECORD_COUNT_PROPERTY]);
  // Workround to handle 1024 workload
  int LOAD_THREADS = (total_ops % 100 == 0)? 100: 64;
  std::cout << "Load threads: " <<  LOAD_THREADS << std::endl;
  for (int i = 0; i < LOAD_THREADS; ++i) {
      actual_ops.emplace_back(async(launch::async, DelegateClientLoading, db, &wl,
                                  total_ops / LOAD_THREADS, true, txrate));
  }

  int sum = 0;
  for (auto &n : actual_ops) {
    assert(n.valid());
    sum += n.get();
  }
  // assert (sum == total_ops);
  cout << "Finish data loading.. (# Loading valid records: " << sum << ") " 
  << (utils::time_now() - loading_start_time) / 1e9 << " s"
  << endl;

  long workload_starting_time = utils::time_now();
  cout << "Start the workload at " << utils::time_now() << endl;
  actual_ops.clear();
  total_ops = stoi(props[ycsbc::CoreWorkload::OPERATION_COUNT_PROPERTY]);
  for (int i = 0; i < num_threads; ++i) {
    actual_ops.emplace_back(async(launch::async, DelegateClient, db, &wl,
                                  total_ops / num_threads, false, txrate));
  }

  sum = 0;
  for (auto &n : actual_ops) {
    assert(n.valid());
    sum += n.get();
  }
  cout << "Finish the workload (total ops:\t" << total_ops << ")" 
  << (utils::time_now() - workload_starting_time) / 1e9 << " s" << endl;
  cout << "Valid ops:\t" << sum << endl;  

  displaySuccessTxnId();
  displayLatency();

  // Stop the status thread
  status_thread_stop = true;
  status_thread_async.wait();
  return 0;
}

string ParseCommandLine(int argc, const char *argv[],
                        utils::Properties &props) {
  int argindex = 1;
  string filename;
  while (argindex < argc && StrStartWith(argv[argindex], "-")) {
    if (strcmp(argv[argindex], "-threads") == 0) {
      argindex++;
      if (argindex >= argc) {
        UsageMessage(argv[0]);
        exit(0);
      }
      props.SetProperty("threadcount", argv[argindex]);
      argindex++;
    } else if (strcmp(argv[argindex], "-db") == 0) {
      argindex++;
      if (argindex >= argc) {
        UsageMessage(argv[0]);
        exit(0);
      }
      props.SetProperty("dbname", argv[argindex]);
      argindex++;
    } else if (strcmp(argv[argindex], "-endpoint") == 0) {
      argindex++;
      if (argindex >= argc) {
        UsageMessage(argv[0]);
        exit(0);
      }
      props.SetProperty("endpoint", argv[argindex]);
      argindex++;
    } else if (strcmp(argv[argindex], "-txrate") == 0) {
      argindex++;
      if (argindex >= argc) {
        UsageMessage(argv[0]);
        exit(0);
      }
      props.SetProperty("txrate", argv[argindex]);
      argindex++;
    } else if (strcmp(argv[argindex], "-wl") == 0) {
      argindex++;
      if (argindex >= argc) {
        UsageMessage(argv[0]);
        exit(0);
      }
      props.SetProperty("workload", argv[argindex]);
      argindex++;
    } else if (strcmp(argv[argindex], "-wt") == 0) {
      argindex++;
      if (argindex >= argc) {
        UsageMessage(argv[0]);
        exit(0);
      }
      props.SetProperty("deploy_wait", argv[argindex]);
      argindex++;
    } else if (strcmp(argv[argindex], "-P") == 0) {
      argindex++;
      if (argindex >= argc) {
        UsageMessage(argv[0]);
        exit(0);
      }
      filename.assign(argv[argindex]);
      ifstream input(argv[argindex]);
      try {
        props.Load(input);
      } catch (const string &message) {
        cout << message << endl;
        exit(0);
      }
      input.close();
      argindex++;
    } else {
      cout << "Unknown option '" << argv[argindex] << "'" << endl;
      exit(0);
    }
  }

  if (argindex == 1 || argindex != argc) {
    UsageMessage(argv[0]);
    exit(0);
  }

  return filename;
}

void UsageMessage(const char *command) {
  cout << "Usage: " << command << " [options]" << endl;
  cout << "Options:" << endl;
  cout << "  -threads n: execute using n threads (default: 1)" << endl;
  cout << "  -wt deploytime: waiting time in second before start to submit "
          "transactions for deployment the smart "
          "contract/chaincode" << endl;
  cout << "  -db dbname: specify the name of the DB to use (e.g., hyperledger)"
       << endl;
  cout << "  -wl workload: specify the type of smart contract to run (choices: "
          "ycsb, donothing, smallbank. By default: donothing)" << endl;
  cout << "  -P propertyfile: load properties from the given file. Multiple "
          "files can" << endl;
  cout << "                   be specified, and will be processed in the order "
          "specified" << endl;
}

inline bool StrStartWith(const char *str, const char *pre) {
  return strncmp(str, pre, strlen(pre)) == 0;
}
