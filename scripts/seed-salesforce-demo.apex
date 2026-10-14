List<String> accountNames = new List<String>{
    'WRT Demo - Vistula Analytics',
    'WRT Demo - Spree Digital',
    'WRT Demo - Oresund HealthTech',
    'WRT Demo - Canal Commerce',
    'WRT Demo - Thames Advisory',
    'WRT Demo - Mazovia Logistics',
    'WRT Demo - Kreuzberg Robotics',
    'WRT Demo - Nordhavn Energy',
    'WRT Demo - Amstel Payments',
    'WRT Demo - Shoreditch Product Studio',
    'WRT Demo - Praga Cloud Systems',
    'WRT Demo - Fleet Street Research'
};
List<String> locations = new List<String>{
    'Warsaw', 'Berlin', 'Copenhagen', 'Amsterdam', 'London', 'Warsaw',
    'Berlin', 'Copenhagen', 'Amsterdam', 'London', 'Warsaw', 'London'
};
List<String> countryNames = new List<String>{
    'Poland', 'Germany', 'Denmark', 'Netherlands', 'United Kingdom', 'Poland',
    'Germany', 'Denmark', 'Netherlands', 'United Kingdom', 'Poland', 'United Kingdom'
};
List<String> countryCodes = new List<String>{
    'PL', 'DE', 'DK', 'NL', 'GB', 'PL', 'DE', 'DK', 'NL', 'GB', 'PL', 'GB'
};
List<Integer> deskCounts = new List<Integer>{24, 42, 18, 35, 60, 12, 28, 50, 75, 16, 85, 120};
List<Decimal> revenues = new List<Decimal>{8400, 18900, 9900, 17500, 42000, 3960, 13720, 27500, 37500, 11200, 28900, 78000};
List<Integer> renewalOffsets = new List<Integer>{7, 15, 23, 33, 48, 63, 91, 138, 199, 260, 352, 383};
String demoDescription = 'Workspace Renewal Tracker demo data.';
Map<String, Account> accountsByName = new Map<String, Account>();

for (Account existingAccount : [
    SELECT Id, Name, Description
    FROM Account
    WHERE Name IN :accountNames
    WITH USER_MODE
]) {
    Assert.areEqual(demoDescription, existingAccount.Description, 'An account name belongs to non-demo data. Stop and resolve the collision.');
    Assert.isFalse(accountsByName.containsKey(existingAccount.Name), 'Duplicate demo account name. Stop and resolve the duplicates.');
    accountsByName.put(existingAccount.Name, existingAccount);
}

Boolean countryPicklistsEnabled = Account.SObjectType.getDescribe().fields.getMap().containsKey('BillingCountryCode');
List<Account> newAccounts = new List<Account>();

for (Integer index = 0; index < accountNames.size(); index++) {
    if (!accountsByName.containsKey(accountNames[index])) {
        Account newAccount = new Account(
            Name = accountNames[index],
            BillingCity = locations[index],
            Description = demoDescription
        );
        if (countryPicklistsEnabled) {
            newAccount.put('BillingCountryCode', countryCodes[index]);
        } else {
            newAccount.BillingCountry = countryNames[index];
        }
        newAccounts.add(newAccount);
    }
}

if (!newAccounts.isEmpty()) {
    insert as user newAccounts;
}

for (Account createdAccount : newAccounts) {
    accountsByName.put(createdAccount.Name, createdAccount);
}

Boolean multiCurrencyEnabled = Workspace_Contract__c.SObjectType.getDescribe().fields.getMap().containsKey('CurrencyIsoCode');
Date referenceDate = Date.today();
List<Workspace_Contract__c> contracts = new List<Workspace_Contract__c>();

for (Integer index = 0; index < accountNames.size(); index++) {
    Workspace_Contract__c demoContract = new Workspace_Contract__c(
        Account__c = accountsByName.get(accountNames[index]).Id,
        Location__c = locations[index],
        Desk_Count__c = deskCounts[index],
        Monthly_Revenue__c = revenues[index],
        Contract_End_Date__c = referenceDate.addDays(renewalOffsets[index]),
        External_Key__c = 'WRT-DEMO-' + String.valueOf(index + 1).leftPad(3, '0')
    );
    if (multiCurrencyEnabled) {
        demoContract.put('CurrencyIsoCode', 'EUR');
    }
    contracts.add(demoContract);
}

upsert as user contracts External_Key__c;
Assert.areEqual(12, contracts.size(), 'Expected twelve demo contracts.');